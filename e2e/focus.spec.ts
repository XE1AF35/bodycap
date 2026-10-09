// Focus: every stop on the way through a screen draws the same solid outline. An outline, unlike a
// box-shadow ring, stays visible in Windows high contrast mode.
import type { Page } from '@playwright/test'
import {
  addPhotos,
  expect,
  open,
  openShareDialog,
  photoFile,
  SAMPLE_COLLECTION,
  SAMPLE_GEAR,
  SAMPLE_SYSTEM,
  seed,
  seedGear,
  test,
} from './fixtures'

/** Tabs through the screen, describing each stop whose focus isn't a solid outline of 2px or more */
async function stopsWithoutOutline(page: Page, stops: number): Promise<string[]> {
  const found = new Set<string>()
  for (let stop = 0; stop < stops; stop += 1) {
    await page.keyboard.press('Tab')
    const problem = await page.evaluate(() => {
      const element = document.activeElement
      // Past the last stop, focus leaves the page
      if (!(element instanceof HTMLElement) || element === document.body) return undefined
      // Focus is on a part the browser draws inside the element, such as the calendar button in a
      // date field. index.css outlines that part too, but its style can't be read from here.
      if (!element.matches(':focus')) return undefined
      // Buttons ease their outline in from the browser's 3px default, so it can read wider at first
      const { outlineStyle, outlineWidth } = getComputedStyle(element)
      if (outlineStyle === 'solid' && Number.parseFloat(outlineWidth) >= 2) return undefined
      const name =
        (element.getAttribute('aria-label') ?? element.id) ||
        element.textContent.trim().slice(0, 40)
      return `${element.tagName.toLowerCase()} "${name}": ${outlineStyle} ${outlineWidth}`
    })
    if (problem !== undefined) found.add(problem)
  }
  return [...found]
}

// Each screen is loaded fresh, so the first Tab starts at the top with the skip link
test('outlines every stop on the gear list', async ({ page }) => {
  await seedGear(page, SAMPLE_GEAR)
  await page.goto('./#/gear')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Gear' })).toBeVisible()
  expect(await stopsWithoutOutline(page, 30)).toEqual([])
})

test('outlines every field and button on the add form', async ({ page }) => {
  await open(page, '#/gear/new')
  await expect(page.getByRole('heading', { level: 1, name: 'Add gear' })).toBeVisible()
  expect(await stopsWithoutOutline(page, 40)).toEqual([])
})

test('outlines every stop on a kit used as a packing checklist', async ({ page }) => {
  await seed(page, SAMPLE_COLLECTION)
  await open(page, '#/kits')
  await page.getByRole('link', { name: 'Wedding kit' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Wedding kit' })).toBeVisible()
  expect(await stopsWithoutOutline(page, 30)).toEqual([])
})

test('outlines every stop on an item with a loan, kits, and maintenance', async ({ page }) => {
  await seed(page, SAMPLE_COLLECTION)
  await open(page, '#/gear')
  await page.getByRole('table').getByRole('link', { name: 'Fujifilm X-T5' }).click()
  await page.reload()
  await expect(page.getByRole('region', { name: 'Maintenance' })).toBeVisible()
  expect(await stopsWithoutOutline(page, 40)).toEqual([])
})

test('outlines every stop on an item with photos', async ({ page }) => {
  await seedGear(page, SAMPLE_GEAR)
  await open(page, '#/gear')
  await page.getByRole('table').getByRole('link', { name: 'Fujifilm X-T5' }).click()
  await addPhotos(page, [await photoFile(page, 'front.jpg'), await photoFile(page, 'top.jpg')])
  await page.reload()
  await expect(page.getByRole('button', { name: 'View photo 2 of 2' })).toBeVisible()
  expect(await stopsWithoutOutline(page, 40)).toEqual([])
})

test('outlines every stop on the system map', async ({ page }) => {
  await seed(page, SAMPLE_SYSTEM)
  await page.goto('./#/system')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'System map' })).toBeVisible()
  expect(await stopsWithoutOutline(page, 40)).toEqual([])
})

test('outlines every stop on a shared kit', async ({ page }) => {
  await seed(page, SAMPLE_COLLECTION)
  const dialog = await openShareDialog(page)
  const link = await dialog.getByRole('textbox', { name: 'Link' }).inputValue()
  await page.goto(link)
  await page.reload()
  await expect(page.getByText(/A copy of a kit someone shared with you/)).toBeVisible()
  expect(await stopsWithoutOutline(page, 30)).toEqual([])
})
