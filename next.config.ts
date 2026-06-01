import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'flagcdn.com' },
      // Escudos/banderas que entrega ESPN al importar torneos (clubes y selecciones).
      { protocol: 'https', hostname: 'a.espncdn.com' },
    ],
  },
};

export default nextConfig;
