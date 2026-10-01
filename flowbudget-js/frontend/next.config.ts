import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Receipt images are forwarded to the API through the proxy.
    proxyClientMaxBodySize: '12mb',
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
