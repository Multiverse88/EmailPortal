/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    const defaultBackend = process.env.NODE_ENV === 'production' ? 'http://backend:4000' : 'http://localhost:4000';
    const backendUrl = process.env.BACKEND_INTERNAL_URL || defaultBackend;
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${backendUrl}/health`,
      },
    ];
  },
};

module.exports = nextConfig;
