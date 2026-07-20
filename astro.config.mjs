// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: 'CPTP .22 LR Scoring',
          short_name: 'CPTP Scoring',
          description: 'App de puntuación para eventos de tiro .22 Long Range — funciona sin internet',
          theme_color: '#ffffff',
          background_color: '#f1f5f9',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          id: '/cptp-scoring/',
          categories: ['sports', 'utilities'],
          icons: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Precache ALL static assets
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,webp,json}'],
          // FIXED: CacheFirst for app assets (offline-first PWA)
          runtimeCaching: [
            {
              // App shell & static assets → CacheFirst (offline works immediately)
              urlPattern: ({ url }) => url.origin === self.location.origin,
              handler: 'CacheFirst',
              options: {
                cacheName: 'cptp-app-cache-v1',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Google Fonts → StaleWhileRevalidate
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'cptp-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
          // Skip waiting — update immediately
          skipWaiting: true,
          clientsClaim: true,
        },
      }),
    ],
  },
});
