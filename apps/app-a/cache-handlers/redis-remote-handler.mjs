import { createClient } from 'redis';

/** Redis 연결 (앱별 .env/.env.local에서 주입) */
const REDIS_URL = process.env.REDIS_URL;
const PREFIX = process.env.NEXT_CACHE_KEY_PREFIX ?? 'next16:remote:';

let clientPromise;

async function getClient() {
  // [수정 1] 빌드 타임(Docker Build)에는 REDIS_URL이 없으므로,
  // 연결 시도 자체를 하지 않고 null을 반환하여 에러 방지
  if (process.env.IS_DOCKER_BUILD === 'true' || !REDIS_URL) {
    return null;
  }

  if (clientPromise) return clientPromise;

  const client = createClient({
    url: REDIS_URL,
    socket: {
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? '5000'),
      reconnectStrategy: retries => Math.min(retries * 50, 1000),
    },
  });

  client.on('error', err => {
    // 연결 에러 로그는 남기되, 빌드가 터지지 않게 함
    console.error('[cacheHandlers][redis] Connection Error:', err.message);
  });

  clientPromise = (async () => {
    try {
      // [수정 2] 연결 시도 중 에러가 나도 catch로 잡아서 null 반환 (프로세스 종료 방지)
      await client.connect();
      return client;
    } catch (error) {
      console.error('[cacheHandlers][redis] Failed to connect:', error.message);
      return null;
    }
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
 */
const cacheHandler = {
  async get(cacheKey, softTags) {
    const client = await getClient();

    // 1. 빌드 타임이거나 연결 실패 시
    if (!client) return undefined;

    const metaKey = `${PREFIX}${cacheKey}:meta`;
    const bodyKey = `${PREFIX}${cacheKey}:body`;

    try {
      const metaJson = await client.get(metaKey);
      const bodyB64 = await client.get(bodyKey);

      // [LOG] 데이터가 아예 없음 -> MISS
      if (!metaJson || !bodyB64) {
        console.log(`[REDIS MISS] Key: ${cacheKey}`);
        return undefined;
      }

      let meta;
      try {
        meta = JSON.parse(metaJson);
      } catch {
        await client.del(metaKey, bodyKey);
        return undefined;
      }

      const now = Date.now();

      // [LOG] 데이터는 있는데 만료됨 -> EXPIRED (MISS 취급)
      if (typeof meta.expire === 'number' && meta.expire > 0) {
        const expireAt = meta.timestamp + meta.expire * 1000;
        if (now > expireAt) {
          console.log(`[REDIS EXPIRED] Key: ${cacheKey}`);
          await client.del(metaKey, bodyKey);
          return undefined;
        }
      }

      if (typeof meta.revalidate === 'number' && meta.revalidate > 0) {
        const revalidateAt = meta.timestamp + meta.revalidate * 1000;
        if (now > revalidateAt) {
          console.log(`[REDIS REVALIDATE] Key: ${cacheKey}`);
          return undefined;
        }
      }

      // softTags 무시
      void softTags;

      const bodyBuf = Buffer.from(bodyB64, 'base64');

      // [LOG] 여기까지 왔으면 성공 -> HIT
      console.log(`[REDIS HIT] 🟢 Key: ${cacheKey}`);

      return {
        value: bufferToStream(bodyBuf),
        tags: meta.tags ?? [],
        stale: meta.stale ?? 0,
        timestamp: meta.timestamp,
        expire: meta.expire ?? 0,
        revalidate: meta.revalidate ?? 0,
      };
    } catch (e) {
      console.error('[cacheHandler] get error:', e.message);
      return undefined;
    }
  },

  async set(cacheKey, pendingEntry) {
    // 문서 요구사항: pendingEntry를 await 해서 entry 확보
    const entry = await pendingEntry;

    const client = await getClient();

    // [수정 4] 클라이언트가 없으면(빌드 타임) 저장하지 않고 리턴
    // entry.value(스트림)는 건드리지 않았으므로 Next.js가 그대로 사용합니다.
    if (!client) return;

    try {
      console.log(`[REDIS SET] 💾 Key: ${cacheKey}`);
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
    } catch (e) {
      console.error('[cacheHandler] set error:', e.message);
    }
  },

  // 아래 3개는 “최소 구현”
  async refreshTags() {},
  async getExpiration(_tags) {
    return 0;
  },
  async updateTags(_tags, _durations) {},
};

export default cacheHandler;
