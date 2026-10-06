// End-to-end tests against the built app, served as it will be published: the real base path,
// the Content Security Policy, and the service worker. Chromium runs everything. WebKit runs the
// storage and offline tests too, on a developer's machine only, since Safari is where those differ.
import { defineConfig, devices } from '@playwright/test'

const port = 4173
const ci = process.env.CI !== undefined

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${String(port)}/bodycap/`,
    trace: 'retain-on-failure',
  },
  webServer: {
    // Always a fresh build, so the tests never run against an old one
    command: `corepack pnpm build && corepack pnpm preview --port ${String(port)} --strictPort`,
    url: `http://localhost:${String(port)}/bodycap/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(ci
      ? []
      : [{ name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /@storage|@offline/ }]),
  ],
})
