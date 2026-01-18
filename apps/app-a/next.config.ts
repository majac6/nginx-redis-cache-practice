import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  cacheMaxMemorySize: 0,
  basePath: '/',
};

export default nextConfig;
