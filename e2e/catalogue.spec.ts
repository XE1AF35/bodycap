// Adding a lens from the Model field's suggestions using only the keyboard: a few words of the
// model, Down to the first suggestion, Enter to fill in what the catalogue knows about it.
import type { Page } from '@playwright/test'
import { expect, open, tabTo, test } from './fixtures'

/** What the details page says for a label, such as "Mount" */
const detail = (page: Page, label: string) =>
  page
    .locator('dl > div')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('dd')

test('adds a lens by keyboard from the model suggestions', async ({ page }) => {
  await open(page, '#/gear/new')
  const { keyboard } = page
  await expect(page.getByRole('heading', { level: 1, name: 'Add gear' })).toBeVisible()

  const model = page.getByRole('combobox', { name: 'Model' })
  await tabTo(page, model)
  await keyboard.type('24-70 2.8')
  const suggestions = page.getByRole('listbox')
  await expect(suggestions.getByRole('option')).toHaveCount(6)
  await expect(suggestions.getByRole('option').first()).toContainText('Sony FE 24-70mm F2.8 GM')
  await keyboard.press('ArrowDown')
  await keyboard.press('Enter')

  await expect(suggestions).toBeHidden()
  await expect(model).toHaveValue('FE 24-70mm F2.8 GM')
  await expect(page.getByRole('combobox', { name: 'Category' })).toHaveValue('lens')
  await expect(page.getByRole('textbox', { name: 'Brand' })).toHaveValue('Sony')
  await expect(page.getByRole('combobox', { name: 'Mount' })).toHaveValue('sony-e')
  await expect(page.getByRole('combobox', { name: 'Lens coverage' })).toHaveValue('full-frame')
  await expect(page.getByRole('textbox', { name: 'Shortest focal length' })).toHaveValue('24')
  await expect(page.getByRole('textbox', { name: 'Longest focal length' })).toHaveValue('70')
  await expect(page.getByRole('textbox', { name: 'Widest aperture', exact: true })).toHaveValue(
    '2.8',
  )
  await expect(page.getByRole('status').filter({ hasText: /^Filled in the category/ })).toHaveText(
    "Filled in the category, brand, mount, lens coverage, focal length, and aperture. Change anything that's different on yours.",
  )

  await tabTo(page, page.getByRole('button', { name: 'Save' }))
  await keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sony FE 24-70mm F2.8 GM' }),
  ).toBeFocused()
  await expect(detail(page, 'Category')).toHaveText('Lens')
  await expect(detail(page, 'Mount')).toHaveText('Sony E (including FE)')
  await expect(detail(page, 'Lens coverage')).toHaveText('Full frame')
  await expect(detail(page, 'Focal length')).toHaveText('24-70mm')
  await expect(detail(page, 'Aperture')).toHaveText('f/2.8')
})

test('shows the rest of the page again when Tab leaves the suggestions', async ({ page }) => {
  await open(page, '#/gear/new')
  const model = page.getByRole('combobox', { name: 'Model' })
  await model.fill('24-70 2.8')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(6)
  // Hidden from screen readers while the suggestions are open
  await expect(page.getByRole('banner')).toHaveCount(0)

  await page.keyboard.press('Tab')
  await expect(page.getByRole('listbox')).toBeHidden()
  await expect(model).not.toBeFocused()
  await expect(model).toHaveValue('24-70 2.8')
  await expect(page.getByRole('banner')).toBeVisible()
})
