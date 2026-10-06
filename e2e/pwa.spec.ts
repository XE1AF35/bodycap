// The install manifest and its icons, and the security policy, as the built app serves them.
import { expect, open, test } from './fixtures'

test('serves a manifest that can be installed, with every icon it names', async ({ page }) => {
  await open(page)
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBe('/bodycap/manifest.webmanifest')

  const response = await page.request.get('manifest.webmanifest')
  expect(response.ok()).toBe(true)
  const manifest = (await response.json()) as {
    name: string
    id: string
    start_url: string
    scope: string
    display: string
    icons: { src: string; sizes: string; purpose?: string }[]
  }
  expect(manifest).toMatchObject({
    name: 'Bodycap',
    id: '/bodycap/',
    start_url: '/bodycap/',
    scope: '/bodycap/',
    display: 'standalone',
  })
  expect(manifest.icons.map(({ sizes, purpose }) => `${sizes} ${purpose ?? 'any'}`)).toEqual(
    expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']),
  )
  for (const { src } of manifest.icons) {
    const icon = await page.request.get(src)
    expect(icon.ok(), src).toBe(true)
    expect(icon.headers()['content-type'], src).toBe('image/png')
  }
})

test.describe('the security policy', () => {
  // This test causes a violation on purpose, to show violations are caught
  test.use({ allowedProblems: [/TrustedHTML|Trusted Type|require-trusted-types-for/i] })

  test('is in force, refusing HTML assigned as a plain string', async ({ page }) => {
    await open(page)
    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content')
    expect(policy).toContain("require-trusted-types-for 'script'")
    expect(policy).toContain("script-src 'self'")
    const refused = await page.evaluate(() => {
      try {
        document.createElement('div').innerHTML = '<img src=x>'
        return false
      } catch {
        return true
      }
    })
    expect(refused).toBe(true)
  })
})
