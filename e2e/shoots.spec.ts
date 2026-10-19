// Shoots: logging one with the gear taken, using only the keyboard.
import { expect, open, SAMPLE_GEAR, seedGear, tabTo, test } from './fixtures'

test('logs a shoot with its gear using only the keyboard', async ({ page }) => {
  await seedGear(page, SAMPLE_GEAR)
  await open(page, '#/shoots')
  const { keyboard } = page
  await expect(page.getByText('No shoots yet.')).toBeVisible()

  await tabTo(page, page.getByRole('button', { name: 'Log a shoot' }))
  await keyboard.press('Enter')
  const form = page.getByRole('dialog', { name: 'Log a shoot' })
  await tabTo(page, form.getByRole('textbox', { name: 'Name' }))
  await keyboard.type('Dawn at Muriwai')
  for (const name of ['Fujifilm X-T5', 'Peak Design Everyday Backpack 20L']) {
    await tabTo(page, form.getByRole('checkbox', { name }))
    await keyboard.press('Space')
  }
  await tabTo(page, form.getByRole('textbox', { name: 'Notes' }))
  await keyboard.type('Gannets nesting.')
  await tabTo(page, form.getByRole('button', { name: 'Save' }))
  await keyboard.press('Enter')
  await expect(form).toBeHidden()

  const shoot = page.getByRole('list', { name: 'Your shoots' }).getByRole('listitem')
  await expect(shoot).toHaveText(/^Dawn at Muriwai.*2 items$/)
  await expect(page.getByText('1 shoot logged this year.')).toBeVisible()
  // Saved, so it's still there after a reload
  await page.reload()
  await expect(shoot).toHaveText(/^Dawn at Muriwai/)
})
