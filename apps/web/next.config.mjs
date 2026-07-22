/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL ?? 'http://localhost:3333';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@imp/shared'],
  // Encaminha /api/* do front para a API NestJS (evita CORS no dev).
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
