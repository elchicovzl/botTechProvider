import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@arc/shared-types', '@arc/ui'],
};

export default nextConfig;
