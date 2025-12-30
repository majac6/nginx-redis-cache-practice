import Redis from 'ioredis';
import { config } from './config';

export const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

export async function getCache(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function setCache(key: string, value: string, ttlSeconds?: number) {
  if (ttlSeconds && ttlSeconds > 0) {
    await redis.set(key, value, 'EX', ttlSeconds);
  } else {
    await redis.set(key, value);
  }
}
