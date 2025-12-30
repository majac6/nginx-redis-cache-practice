// packages/prerender/src/config.ts
export const config = {
  port: Number(process.env.PORT ?? 4000),
  redisUrl: process.env.REDIS_URL ?? 'redis://:local-dev-redis@127.0.0.1:6379',
  cachePrefix: process.env.PRERENDER_CACHE_PREFIX ?? 'prerender:',
};
