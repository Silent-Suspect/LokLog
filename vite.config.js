import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            // SPECIFIC RULE FOR CLERK AUTHENTICATION
            // Matches the Clerk JS bundle and the Clerk dev domain
            urlPattern: ({ url }) => url.href.includes('clerk.browser.js') || url.hostname.includes('clerk.accounts.dev'),

            // StaleWhileRevalidate: Use the cached version immediately (fast/offline), 
            // but try to update it in the background if network is available.
            handler: 'StaleWhileRevalidate',

            options: {
              cacheName: 'clerk-js-cache',
              expiration: {
                maxEntries: 10,
                // Keep the script for 7 days
                maxAgeSeconds: 60 * 60 * 24 * 7
              },
              cacheableResponse: {
                // Cache valid responses and opaque responses (0) from CORS
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'LokLog',
        short_name: 'LokLog',
        description: 'Fahrtenbuch für Lokführer',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
