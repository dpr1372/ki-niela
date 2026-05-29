import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ki-Niela',
    short_name: 'Ki-Niela',
    description: 'Plataforma de quinielas deportivas recreativas',
    start_url: '/quinielas',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1e3a5f',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
