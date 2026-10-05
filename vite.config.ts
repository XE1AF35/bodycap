import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages serves the app from /bodycap/. BASE_PATH lets another host use its own path.
  base: process.env.BASE_PATH ?? '/bodycap/',
  plugins: [react()],
  resolve: {
    // Same @/ alias as tsconfig.app.json
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    projects: [
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
