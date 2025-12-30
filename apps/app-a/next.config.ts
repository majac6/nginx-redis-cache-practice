import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  cacheMaxMemorySize: 0,
  basePath: '/app-a',
};

export default nextConfig;
