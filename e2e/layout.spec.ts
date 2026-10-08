// Layouts that must fit, from a laptop down to a phone: the system map's strips stay inside their
// cards, and the dashboard's stats tables never scroll sideways.
import { expect, open, SAMPLE_COLLECTION, SAMPLE_SYSTEM, seed, test } from './fixtures'

const SIZES = [
  ['a laptop', 1280],
  ['a phone', 390],
] as const

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
