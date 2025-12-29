import { createClient } from 'redis';

/** Redis 연결 (앱별 .env/.env.local에서 주입) */
const REDIS_URL = process.env.REDIS_URL;
const PREFIX = process.env.NEXT_CACHE_KEY_PREFIX ?? 'next16:remote:';

let clientPromise;

async function getClient() {
  if (clientPromise) return clientPromise;

  const client = createClient({
    url: REDIS_URL,
    socket: {
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? '5000'),
      reconnectStrategy: retries => Math.min(retries * 50, 1000),
    },
  });

  client.on('error', err => console.error('[cacheHandlers][redis]', err));

  clientPromise = (async () => {
    await client.connect();
    return client;
  })();

  return clientPromise;
}

/** ReadableStream<Uint8Array> -> Buffer */
async function streamToBuffer(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }

  const buf = Buffer.allocUnsafe(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buf;
}

/** Buffer -> ReadableStream<Uint8Array> */
function bufferToStream(buf) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
}

/**
 * CacheEntry 구조(문서):
 * { value: ReadableStream<Uint8Array>, tags: string[], stale, timestamp, expire, revalidate }
 * :contentReference[oaicite:6]{index=6}
 */
const cacheHandler = {
  async get(cacheKey, softTags) {
    const client = await getClient();
    const metaKey = `${PREFIX}${cacheKey}:meta`;
    const bodyKey = `${PREFIX}${cacheKey}:body`;

    const metaJson = await client.get(metaKey);
    const bodyB64 = await client.get(bodyKey);

    if (!metaJson || !bodyB64) return undefined;

    let meta;
    try {
      meta = JSON.parse(metaJson);
    } catch {
      // 깨진 메타는 삭제하고 MISS 처리
      await client.del(metaKey, bodyKey);
      return undefined;
    }

    const now = Date.now();

    // expire 기준 만료 처리 (seconds)
    if (typeof meta.expire === 'number' && meta.expire > 0) {
      const expireAt = meta.timestamp + meta.expire * 1000;
      if (now > expireAt) {
        await client.del(metaKey, bodyKey);
        return undefined;
      }
    }

    // 필요 시 revalidate 기준도 확인 (seconds)
    if (typeof meta.revalidate === 'number' && meta.revalidate > 0) {
      const revalidateAt = meta.timestamp + meta.revalidate * 1000;
      if (now > revalidateAt) {
        // "없음"으로 처리해 Next가 재생성하도록 유도
        return undefined;
      }
    }

    // softTags는 여기서는 단순 무시(고급 구현 시 태그 타임스탬프와 비교)
    void softTags;

    const bodyBuf = Buffer.from(bodyB64, 'base64');

    return {
      value: bufferToStream(bodyBuf),
      tags: meta.tags ?? [],
      stale: meta.stale ?? 0,
      timestamp: meta.timestamp,
      expire: meta.expire ?? 0,
      revalidate: meta.revalidate ?? 0,
    };
  },

  async set(cacheKey, pendingEntry) {
    const client = await getClient();

    // 문서 요구사항: pendingEntry를 await 해서 entry 확보 :contentReference[oaicite:7]{index=7}
    const entry = await pendingEntry;

    // ReadableStream은 1회 소비이므로 tee()로 복제해서
    // 한쪽은 저장용, 한쪽은 Next가 계속 사용하도록 유지
    const [forCache, forNext] = entry.value.tee();
    entry.value = forNext;

    const bodyBuf = await streamToBuffer(forCache);

    const meta = {
      tags: entry.tags ?? [],
      stale: entry.stale ?? 0,
      timestamp: entry.timestamp,
      expire: entry.expire ?? 0,
      revalidate: entry.revalidate ?? 0,
    };

    const metaKey = `${PREFIX}${cacheKey}:meta`;
    const bodyKey = `${PREFIX}${cacheKey}:body`;

    await client.set(metaKey, JSON.stringify(meta));
    await client.set(bodyKey, bodyBuf.toString('base64'));
  },

  // 아래 3개는 “최소 구현” (태그 무효화까지 하려면 확장 필요)
  async refreshTags() {},
  async getExpiration(_tags) {
    return 0;
  },
  async updateTags(_tags, _durations) {},
};

export default cacheHandler;