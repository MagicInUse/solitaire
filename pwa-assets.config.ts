import { defineConfig } from '@vite-pwa/assets-generator/config'

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
