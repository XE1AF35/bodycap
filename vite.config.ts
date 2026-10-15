import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { checkOutput } from './build/check-output.ts'
import { securityMeta } from './build/security.ts'
import { versionFile } from './build/version-file.ts'
import { SCHEMA_VERSION } from './src/data/schema-version.ts'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string
}

// GitHub Pages serves the app from /bodycap/. BASE_PATH lets another host use its own path.
const base = process.env.BASE_PATH ?? '/bodycap/'
const outDir = 'dist'
// The dark theme's background (--background in index.css), which is the default
const DARK = '#0d0e11'

export default defineConfig({
  base,
  build: { outDir },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new version waits until the person chooses to reload (src/ui/pwa/UpdatePrompt.tsx)
      registerType: 'prompt',
      // Bodycap registers the worker itself, with a URL approved by Trusted Types
      // (src/ui/pwa/register.ts), as the plugin's own registration passes a plain string
      injectRegister: false,
      // The escape hatch: a build with PWA_SELF_DESTROY=true ships a worker that removes itself,
      // should a broken one ever be published
      selfDestroying: process.env.PWA_SELF_DESTROY === 'true',
      manifest: {
        id: base,
        name: 'Bodycap',
        short_name: 'Bodycap',
        description:
          'Store, organise, and keep track of your camera gear. Your data stays in this browser.',
        lang: 'en-NZ',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: DARK,
        background_color: DARK,
        // Made from public/app-icon.png (see pwa-assets.config.js)
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Everything is precached, icons and the data font included, so the whole app works offline
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
    securityMeta(),
    versionFile(version, SCHEMA_VERSION),
    checkOutput(outDir, base, SCHEMA_VERSION),
  ],
  // Backups record which version of the app made them
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    // Same @/ alias as tsconfig.app.json
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    coverage: {
      provider: 'v8',
      // The domain logic is the part that must be fully tested; the UI is covered by its own tests
      include: ['src/core/**/*.ts'],
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'core',
          include: ['tests/core/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          // Storage tests run on fake-indexeddb, passed to Dexie per test, so no browser is needed
          name: 'data',
          include: ['tests/data/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/setup-data.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          include: ['tests/ui/**/*.test.tsx'],
          environment: 'jsdom',
          // A whole app in jsdom, typing key by key, can take a few seconds on its first test while
          // the worker warms up, and more under coverage. A test that truly hangs still fails.
          testTimeout: 15_000,
          setupFiles: ['tests/setup-ui.ts'],
          // Vitest empties CSS imports unless asked, and the token test reads index.css as text
          css: { include: [/src\/index\.css/] },
        },
      },
      {
        extends: true,
        test: {
          // The build's own checks, such as the size budgets
          name: 'build',
          include: ['tests/build/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
})
