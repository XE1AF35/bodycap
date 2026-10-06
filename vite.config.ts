import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string
}

export default defineConfig({
  // GitHub Pages serves the app from /bodycap/. BASE_PATH lets another host use its own path.
  base: process.env.BASE_PATH ?? '/bodycap/',
  plugins: [react()],
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
          setupFiles: ['tests/setup-ui.ts'],
        },
      },
    ],
  },
})
