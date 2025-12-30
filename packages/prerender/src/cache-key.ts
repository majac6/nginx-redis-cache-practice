import crypto from 'crypto';
import { config } from './config';

export function buildCacheKey(url: string): string {
  const hash = crypto.createHash('sha256').update(url).digest('hex');
  return `${config.cachePrefix}${hash}`;
}
