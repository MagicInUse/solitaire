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
    // Apple splash screens — generated into public/ then linked from index.html.
    // Run `pnpm generate-pwa-assets` to (re)generate after changing this list.
    // Each size produces a portrait PNG and a landscape PNG; the linkMediaOptions
    // block prints the correct <link> tags to stdout during generation.
    appleSplashScreens: {
      padding: 0.3,
      resizeOptions: { background: '#1d1e2c', fit: 'contain' },
      linkMediaOptions: {
        log: true,
        addMediaScreen: true,
        basePath: '/',
        xhtml: false,
      },
      sizes: [
        // iPhone SE (1st generation) — 640 × 1136 @2x
        { width: 320, height: 568, scaleFactor: 2 },
        // iPhone SE (2nd/3rd gen) / iPhone 8 — 750 × 1334 @2x
        { width: 375, height: 667, scaleFactor: 2 },
        // iPhone 8 Plus — 1242 × 2208 @3x
        { width: 414, height: 736, scaleFactor: 3 },
        // iPhone X / XS / 11 Pro / 12 mini / 13 mini — 1125 × 2436 @3x
        { width: 375, height: 812, scaleFactor: 3 },
        // iPhone XR / 11 — 828 × 1792 @2x
        { width: 414, height: 896, scaleFactor: 2 },
        // iPhone XS Max / 11 Pro Max — 1242 × 2688 @3x
        { width: 414, height: 896, scaleFactor: 3 },
        // iPhone 12 / 12 Pro / 13 / 13 Pro / 14 — 1170 × 2532 @3x
        { width: 390, height: 844, scaleFactor: 3 },
        // iPhone 12 Pro Max / 13 Pro Max / 14 Plus — 1284 × 2778 @3x
        { width: 428, height: 926, scaleFactor: 3 },
        // iPhone 14 Pro / 15 / 15 Pro — 1179 × 2556 @3x
        { width: 393, height: 852, scaleFactor: 3 },
        // iPhone 14 Pro Max / 15 Plus / 15 Pro Max — 1290 × 2796 @3x
        { width: 430, height: 932, scaleFactor: 3 },
        // iPad (9.7", 7th–9th gen) — 1536 × 2048 @2x
        { width: 768, height: 1024, scaleFactor: 2 },
        // iPad Air (10.5") / iPad Pro (10.5") — 1668 × 2224 @2x
        { width: 834, height: 1112, scaleFactor: 2 },
        // iPad Pro (11") / iPad Air (10.9" / 11") — 1668 × 2388 @2x
        { width: 834, height: 1194, scaleFactor: 2 },
        // iPad Pro (12.9") — 2048 × 2732 @2x
        { width: 1024, height: 1366, scaleFactor: 2 },
      ],
    },
  },
  images: ['public/favicon.png'],
})
