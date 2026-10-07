// Kits: making one, adding gear, and packing it with the checklist, using only the keyboard.
import { expect, open, SAMPLE_GEAR, seedGear, tabTo, test } from './fixtures'

test('makes a kit, adds gear, and packs it using only the keyboard', async ({ page }) => {
  await seedGear(page, SAMPLE_GEAR)
  await open(page, '#/kits')
  const { keyboard } = page

  await tabTo(page, page.getByRole('button', { name: 'New kit' }))
  await keyboard.press('Enter')
  const form = page.getByRole('dialog', { name: 'New kit' })
  await tabTo(page, form.getByRole('textbox', { name: 'Name' }))
  await keyboard.type('Weekend kit')
  await tabTo(page, form.getByRole('button', { name: 'Create kit' }))
  await keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Weekend kit' })).toBeVisible()

  await tabTo(page, page.getByRole('button', { name: 'Add gear' }))
  await keyboard.press('Enter')
  const picker = page.getByRole('dialog', { name: 'Add gear to Weekend kit' })
  for (const name of ['Fujifilm X-T5', 'Peak Design Everyday Backpack 20L']) {
    await tabTo(page, picker.getByRole('checkbox', { name }))
    await keyboard.press('Space')
  }
  await tabTo(page, picker.getByRole('button', { name: 'Add to kit' }))
  await keyboard.press('Enter')
  await expect(picker).toBeHidden()
  const contents = page.getByRole('region', { name: 'In this kit' })
  await expect(contents.getByRole('listitem')).toHaveCount(2)

  await tabTo(page, page.getByRole('checkbox', { name: 'Use as a packing checklist' }))
  await keyboard.press('Space')
  await expect(page.getByText('0 of 2 packed')).toBeVisible()
  await tabTo(page, contents.getByRole('checkbox', { name: 'Fujifilm X-T5' }))
  await keyboard.press('Space')
  await expect(page.getByText('1 of 2 packed')).toBeVisible()

  // Packing is saved as it happens, so it's all still there after a reload
  await page.reload()
  await expect(page.getByText('1 of 2 packed')).toBeVisible()
  await expect(contents.getByRole('checkbox', { name: 'Fujifilm X-T5' })).toBeChecked()
})
