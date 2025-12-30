import { getCache, setCache } from './cache';
import { buildCacheKey } from './cache-key';
import { config } from './config';

export async function render(url: string): Promise<{
  html: string;
  cache: 'HIT' | 'MISS';
}> {
  const key = buildCacheKey(url);

  const cached = await getCache(key);
  if (cached) {
    return { html: cached, cache: 'HIT' };
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'prerender-service',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();

  await setCache(key, html, config.cacheTtlSeconds);

  return { html, cache: 'MISS' };
}
