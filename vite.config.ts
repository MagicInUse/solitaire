import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      // 'prompt' — never auto-reloads the page mid-game. The UpdateBanner
      // component in App.tsx surfaces the update to the user when they're idle.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Solitaire by MagicApps',
        short_name: 'Solitaire',
        description: 'Offline-first Klondike Solitaire by MagicApps',
        lang: 'en',
        theme_color: '#1d1e2c',
        background_color: '#1d1e2c',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        id: 'magicapps-solitaire',
        categories: ['games', 'entertainment'],
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Essential for SPA offline: serve the cached app shell for any
        // navigation request that isn't explicitly precached.
        navigateFallback: 'index.html',
        // Remove stale precache partitions left by previous builds so storage
        // doesn't grow unboundedly across deploys.
        cleanupOutdatedCaches: true,
        // NOTE: skipWaiting and clientsClaim are intentionally omitted.
        // registerType:'prompt' means the new SW waits until the user confirms
        // via UpdateBanner. Forcing activation here would cause asset-version
        // mismatches mid-session (new SW + old page assets).
        runtimeCaching: [
          {
            // Static assets: serve from cache first; refresh in the background.
            urlPattern: /\.(?:png|ico|svg|woff2)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 128,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
})
