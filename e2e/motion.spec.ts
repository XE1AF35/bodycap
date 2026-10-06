// Motion: when someone asks their device for less motion, nothing on screen animates or eases,
// including the dialog animations that come with shadcn. With motion allowed, the same screens do
// move, which shows the reduced-motion checks are measuring something.
import type { Page } from '@playwright/test'
import { expect, open, SAMPLE_GEAR, seedGear, test } from './fixtures'

/** Each element set to animate or transition for longer than a millisecond, and for how long */
async function stillMoving(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const longest = (durations: string) =>
      Math.max(
        ...durations.split(',').map((duration) => {
          const value = Number.parseFloat(duration)
          return duration.trim().endsWith('ms') ? value / 1000 : value
        }),
      )
    return [...document.querySelectorAll('*')].flatMap((element) => {
      const style = getComputedStyle(element)
      const animation = style.animationName === 'none' ? 0 : longest(style.animationDuration)
      const transition = longest(style.transitionDuration)
      if (animation <= 0.001 && transition <= 0.001) return []
      const classes = (element.getAttribute('class') ?? '').slice(0, 60)
      return [
        `${element.tagName.toLowerCase()} "${classes}": animation ${style.animationName} ${style.animationDuration}, transition ${style.transitionDuration}`,
      ]
    })
  })
}

/** The delete dialog for the X-T5, open */
async function openDeleteDialog(page: Page) {
  await seedGear(page, SAMPLE_GEAR)
  await open(page, '#/gear')
  await expect(page.getByRole('heading', { level: 1, name: 'Gear' })).toBeVisible()
  await page.getByRole('table').getByRole('link', { name: 'Fujifilm X-T5' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('keeps the welcome and its empty state still', async ({ page }) => {
    await open(page)
    await expect(page.getByText('Every kit starts with one body.')).toBeVisible()
    expect(await stillMoving(page)).toEqual([])
  })

  test('keeps the gear list still', async ({ page }) => {
    await seedGear(page, SAMPLE_GEAR)
    await open(page, '#/gear')
    await expect(page.getByRole('table')).toBeVisible()
    expect(await stillMoving(page)).toEqual([])
  })

  test('opens and closes the delete dialog without animating', async ({ page }) => {
    const dialog = await openDeleteDialog(page)
    expect(await stillMoving(page)).toEqual([])
    await dialog.getByRole('button', { name: 'Keep it' }).click()
    await expect(dialog).toBeHidden()
  })
})

test.describe('with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('lets empty states rise in', async ({ page }) => {
    await open(page)
    const emptyState = page.getByText('Every kit starts with one body.').locator('..')
    expect(await emptyState.evaluate((element) => getComputedStyle(element).animationName)).toBe(
      'rise-in',
    )
  })

  test('lets dialogs fade and zoom in', async ({ page }) => {
    const dialog = await openDeleteDialog(page)
    const { animationName, animationDuration } = await dialog.evaluate((element) => {
      const style = getComputedStyle(element)
      return { animationName: style.animationName, animationDuration: style.animationDuration }
    })
    expect(animationName).not.toBe('none')
    expect(Number.parseFloat(animationDuration)).toBeGreaterThan(0.01)
  })
})
