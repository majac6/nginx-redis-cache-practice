// apps/appA/cache-handler.mjs
import { createClient } from "redis";

/* ---------------------------------------
 * Env helpers
 * ------------------------------------- */

function getRedisUrl() {
  // 1. 명시적 설정이 최우선
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  // 2. 개발: kubectl port-forward 전제
  if (process.env.NODE_ENV !== "production") {
    return "redis://127.0.0.1:6379";
  }

  // 3. 운영(K8s): Service DNS
  return "redis://redis-master.redis.svc.cluster.local:6379";
}

function getKeyPrefix() {
  // appA/appB/appC 충돌 방지
  return process.env.NEXT_CACHE_KEY_PREFIX ?? "nextcache:";
}

function isEnabled() {
  // NEXT_CACHE_REDIS_ENABLED=0 이면 Redis 캐시 비활성화
  return process.env.NEXT_CACHE_REDIS_ENABLED !== "0";
}

/* ---------------------------------------
 * Binary-safe JSON encode/decode
 * (Next 15 대응: Buffer/Uint8Array)
 * ------------------------------------- */

function encode(value) {
  return JSON.stringify(value, (_k, v) => {
    if (Buffer.isBuffer(v)) {
      return { __type: "Buffer", b64: v.toString("base64") };
    }
    if (v instanceof Uint8Array) {
      return { __type: "Uint8Array", b64: Buffer.from(v).toString("base64") };
    }
    return v;
  });
}

function decode(str) {
  return JSON.parse(str, (_k, v) => {
    if (v?.__type === "Buffer") {
      return Buffer.from(v.b64, "base64");
    }
    if (v?.__type === "Uint8Array") {
      return new Uint8Array(Buffer.from(v.b64, "base64"));
    }
    return v;
  });
}

/* ---------------------------------------
 * Redis singleton (HMR-safe)
 * ------------------------------------- */

let redisClient;

async function getClient() {
  if (!isEnabled()) return null;
  if (redisClient) return redisClient;

  const client = createClient({
    url: getRedisUrl(),
    socket: {
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? "5000"),
      reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
    },
  });

  client.on("error", (err) => {
    if (process.env.NEXT_PRIVATE_DEBUG_CACHE) {
      console.error("[next-cache][redis]", err);
    }
  });

  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis connect timeout")), 5000),
      ),
    ]);
    redisClient = client;
    return redisClient;
  } catch {
    try {
      await client.disconnect();
    } catch {}
    return null;
  }
}

/* ---------------------------------------
 * Tag index helpers
 * ------------------------------------- */

const tagSetKey = (prefix, tag) => `${prefix}__tag__:${tag}`;

/* ---------------------------------------
 * Next.js Cache Handler (ESM)
 * ------------------------------------- */

export default class RedisCacheHandler {
  constructor() {
    this.prefix = getKeyPrefix();
  }

  async get(key) {
    const client = await getClient();
    if (!client) return null;

    const raw = await client.get(this.prefix + key);
    if (!raw) return null;

    try {
      return decode(raw);
    } catch {
      // 파손된 캐시는 MISS 처리
      return null;
    }
  }

  async set(key, data, ctx) {
    const client = await getClient();
    if (!client) return;

    const redisKey = this.prefix + key;

    if (data === null) {
      await client.del(redisKey);
      return;
    }

    await client.set(redisKey, encode(data));

    // tag → key 인덱싱 (revalidateTag 지원)
    const tags = ctx?.tags ?? [];
    if (tags.length) {
      const multi = client.multi();
      for (const tag of tags) {
        multi.sAdd(tagSetKey(this.prefix, tag), redisKey);
      }
      await multi.exec();
    }

    // 선택적 TTL (Next 내부 stale 판단과 별개)
    const ttl = Number(process.env.NEXT_CACHE_ENTRY_TTL_SECONDS ?? "0");
    if (ttl > 0) {
      await client.expire(redisKey, ttl);
    }
  }

  async revalidateTag(tag) {
    const client = await getClient();
    if (!client) return;

    const tags = Array.isArray(tag) ? tag : [tag];

    for (const t of tags) {
      const setKey = tagSetKey(this.prefix, t);
      const keys = await client.sMembers(setKey);

      if (keys.length) {
        await client.del(keys);
      }
      await client.del(setKey);
    }
  }

  // Next 15 요청 단위 캐시 리셋 훅
  resetRequestCache() {
    /* noop */
  }
}
