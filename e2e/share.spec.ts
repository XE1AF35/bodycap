// Sharing a kit as a link: it opens in another browser as a read-only copy, and its gear goes on
// that browser's wishlist. Nothing private travels in the link.
import {
  expect,
  openShareDialog,
  SAMPLE_COLLECTION,
  seed,
  test,
  watchForProblems,
} from './fixtures'

test('opens a shared kit in another browser, and adds its gear to the wishlist @storage', async ({
  page,
  browser,
}) => {
  await seed(page, SAMPLE_COLLECTION)
  const dialog = await openShareDialog(page)
  await dialog.getByRole('checkbox', { name: 'Include prices' }).check()
  const link = await dialog.getByRole('textbox', { name: 'Link' }).inputValue()

  // Anyone with the link can read what's in it, so the serial must not be there
  const [, part = ''] = link.split('#/shared/')
  const inside = Buffer.from(part, 'base64url').toString('utf8')
  expect(inside).toContain('X-T5')
  expect(inside).not.toContain('XT5-0042')

  // A new browser context has its own, empty storage, like someone else's browser
  const context = await browser.newContext()
  const other = await context.newPage()
  const problems = watchForProblems(other)
  await other.goto(link)
  await expect(other.getByRole('heading', { level: 1, name: 'Wedding kit' })).toBeVisible()
  const list = other.getByRole('region', { name: 'In this kit' })
  await expect(list.getByRole('checkbox', { checked: true })).toHaveCount(3)
  await other.getByRole('button', { name: 'Add to my wishlist' }).click()
  await expect(other.getByText('Added 3 items to your wishlist.')).toBeVisible()

  await other.getByRole('link', { name: 'See your wishlist' }).click()
  await expect(other.getByRole('heading', { level: 1, name: 'Gear' })).toBeVisible()
  const names = other.getByRole('table').getByRole('link')
  await expect(names).toHaveCount(3)
  expect((await names.allTextContents()).sort()).toEqual([
    'Fujifilm X-T5',
    'Fujifilm XF 33mm F1.4 R LM WR',
    'Peak Design Everyday Backpack 20L',
  ])
  expect(problems).toEqual([])
  await context.close()
})

// Chromium only (no tag): it's the browser where a test can be given the clipboard
test('copies the link to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await seed(page, SAMPLE_COLLECTION)
  const dialog = await openShareDialog(page)
  const link = await dialog.getByRole('textbox', { name: 'Link' }).inputValue()
  await dialog.getByRole('button', { name: 'Copy link' }).click()
  await expect(dialog.getByText('Link copied.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link)
})
