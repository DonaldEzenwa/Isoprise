/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '12mb' },
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  poweredByHeader: false,
};

export default nextConfig;
