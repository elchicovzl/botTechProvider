import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@arc/shared-types', '@arc/ui'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/graphql',
  },
};

export default nextConfig;
