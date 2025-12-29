import Redis from 'ioredis';

declare global {
  // dev에서 hot-reload로 다중 연결 생성되는 것을 방지
  // eslint-disable-next-line no-var
  var __redis__: Redis | undefined;
}

export type RedisClient = Redis;

function getRedisUrl() {
  // 개발: port-forward로 localhost:6379
  // 운영(k8s): redis-master.redis.svc.cluster.local:6379 같은 서비스 DNS 사용
  return process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
}

export function getRedis(): Redis {
  if (global.__redis__) return global.__redis__;

  const url = getRedisUrl();
  const client = new Redis(url, {
    // 연결이 안 되어도 앱이 바로 죽지 않게(개발 편의)
    lazyConnect: false,
    maxRetriesPerRequest: 2,
  });

  global.__redis__ = client;
  return client;
}
