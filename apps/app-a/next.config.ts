import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  // ✅ Next 16.1.1: experimental이 아니라 최상위로 이동
  // cacheComponents: true,

  // ✅ plural: cacheHandlers
  // cacheHandler: require.resolve('./cache-handlers/redis-remote-handler.mjs'),
  cacheMaxMemorySize: 0,
  basePath: '/app-a',
};

export default nextConfig;
