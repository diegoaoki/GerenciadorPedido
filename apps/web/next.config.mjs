/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL ?? 'http://localhost:3333';

const nextConfig = {
  reactStrictMode: true,
  // Encaminha /api/* do front para a API NestJS (local no dev; Vercel em prod
  // via env API_URL). Evita CORS e mantém o painel agnóstico de onde a API está.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
