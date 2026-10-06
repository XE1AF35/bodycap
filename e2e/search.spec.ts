// Searching and filtering the gear list, with the filters kept in the address through a reload.
import { expect, open, SAMPLE_GEAR, seedGear, test } from './fixtures'

test('searches and filters, keeping both in the address', async ({ page }) => {
  await seedGear(page, SAMPLE_GEAR)
  await open(page, '#/gear')
  const table = page.getByRole('table')
  const count = page.getByRole('status').filter({ hasText: 'Showing' })
  await expect(count).toHaveText('Showing 3 of 3')

  await page.getByRole('searchbox', { name: 'Search' }).fill('sony')
  await expect(count).toHaveText('Showing 1 of 3')
  await expect(table.getByRole('link')).toHaveText(['Sony FE 24-70mm F2.8 GM II'])
  await expect(page).toHaveURL(/q=sony/)

  await page.reload()
  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('sony')
  await expect(count).toHaveText('Showing 1 of 3')

  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.getByRole('combobox', { name: 'Status' }).selectOption('Lent out')
  await expect(table.getByRole('link')).toHaveText(['Fujifilm X-T5'])
  await expect(page).toHaveURL(/status=lent-out/)
})
