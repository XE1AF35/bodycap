// Offline use: once the service worker has the app, it opens and moves between pages with no network.
import type { Page } from '@playwright/test'
import { expect, open, test } from './fixtures'

/** Opens the app, then waits until the service worker has it and looks after the page */
async function installApp(page: Page) {
  await open(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // The first visit installs the worker, and it looks after the page from the next load
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)
}

// Chromium only (no @offline tag). Playwright's offline switch in WebKit also cuts off the service
// worker, which Safari doesn't, and WebKit can't simulate a reload with the network refused
// either, so the next test covers WebKit.
test('reloads and moves between pages with no network', async ({ page, context }) => {
  await installApp(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Bodycap' })).toBeVisible()
  // Each page's code loads on first visit, and comes from the service worker's cache
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await page.getByRole('link', { name: 'Gear' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gear' })).toBeVisible()
})

test('keeps working from its cache when the network goes @offline', async ({ page, context }) => {
  await installApp(page)
  // Every request that would reach the network fails, so only the worker's cache can answer
  await context.route('**/*', (route) => route.abort('internetdisconnected'))
  const fetched = await page.evaluate(async () => (await fetch('./index.html')).status)
  expect(fetched).toBe(200)
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await page.getByRole('link', { name: 'Gear' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gear' })).toBeVisible()
})
