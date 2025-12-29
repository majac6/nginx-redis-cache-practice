import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  cacheHandler: require.resolve("./cache-handler.mjs"),
  cacheMaxMemorySize: 0,
};

export default nextConfig;
