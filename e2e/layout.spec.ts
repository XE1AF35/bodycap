// Layouts that must fit, from a laptop down to a phone: the header's links stay on one row, the
// system map's strips stay inside their cards, the dashboard's stats tables never scroll sideways,
// and nor do the shoots, shoot, and money pages on a phone.
import { expect, open, SAMPLE_COLLECTION, SAMPLE_SYSTEM, seed, test } from './fixtures'

const SIZES = [
  ['a laptop', 1280],
  ['a phone', 390],
] as const

// From the narrowest width that shows the links in a row, rather than behind the Menu button,
// through the widths where they wrap below the name, to a laptop
for (const width of [640, 720, 1280]) {
  test(`keeps the header's links on one row at ${String(width)} pixels wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await open(page)
    const links = page.getByRole('navigation', { name: 'Main' }).getByRole('link')
    await expect(links).toHaveText([
      'Dashboard',
      'Gear',
      'Kits',
      'Shoots',
      'Money',
      'System',
      'Settings',
    ])
    const tops = await links.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().top),
    )
    expect(new Set(tops).size).toBe(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  })
}

test('fits the open menu on a phone without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('link', { name: 'Shoots' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})

for (const [size, width] of SIZES) {
  test(`keeps every focal length strip inside its card on ${size}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await seed(page, SAMPLE_SYSTEM)
    await open(page, '#/system')
    const cards = page.getByRole('region', { name: /^Nikon Z/ })
    await expect(cards).toHaveCount(2)
    for (const card of await cards.all()) {
      const outside = await card.evaluate((element) => {
        const edge = element.getBoundingClientRect()
        return Array.from(element.querySelectorAll('svg rect, svg circle, svg text'))
          .map((shape) => shape.getBoundingClientRect())
          .filter((box) => box.left < edge.left || box.right > edge.right).length
      })
      expect(outside).toBe(0)
    }
  })

  test(`fits the dashboard stats without scrolling sideways on ${size}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await seed(page, SAMPLE_COLLECTION)
    await open(page)
    const stats = page.getByRole('region', { name: 'Your gear in numbers' })
    await expect(stats.getByRole('table')).toHaveCount(4)
    const scrolling = await stats.evaluate(
      (element) =>
        Array.from(element.querySelectorAll('table'))
          .map((table) => table.parentElement)
          .filter((box) => box !== null && box.scrollWidth > box.clientWidth).length,
    )
    expect(scrolling).toBe(0)
  })
}

for (const [name, route, heading] of [
  ['the shoots page', '#/shoots', 'Shoots'],
  ['the money page', '#/money', 'Money'],
] as const) {
  test(`fits ${name} on a phone without scrolling sideways`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await seed(page, SAMPLE_COLLECTION)
    await open(page, route)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  })
}

test("fits a shoot's page on a phone without scrolling sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seed(page, SAMPLE_COLLECTION)
  await open(page, '#/shoots')
  await page.getByRole('link', { name: 'Wedding, Arrowtown' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Wedding, Arrowtown' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})
