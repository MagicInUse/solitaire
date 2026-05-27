import { defineConfig } from '@vite-pwa/assets-generator/config'

// Generates favicon.ico, pwa-*.png, maskable-icon-512x512.png, apple-touch-icon-180x180.png
// from the app logo (favicon.png).  Splash screens are in pwa-splashes.config.ts.
export default defineConfig({
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[64, 'favicon.ico']],
    },
    maskable: {
      sizes: [512],
      resizeOptions: { background: '#1d1e2c', fit: 'contain' },
      padding: 0.3,
    },
    apple: {
      sizes: [180],
      resizeOptions: { background: '#1d1e2c', fit: 'contain' },
      padding: 0.3,
    },
  },
  images: ['public/favicon.png'],
})
