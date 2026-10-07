// Loans: lending an item, seeing it out on the dashboard, and marking it returned.
import { daysFromToday, expect, open, SAMPLE_GEAR, seedGear, test } from './fixtures'

test('lends an item, shows it as out, and takes it back', async ({ page }) => {
  await seedGear(page, SAMPLE_GEAR)
  await open(page, '#/gear')
  await page.getByRole('table').getByRole('link', { name: 'Sony FE 24-70mm F2.8 GM II' }).click()

  await page.getByRole('button', { name: 'Lend' }).click()
  const lend = page.getByRole('dialog', { name: 'Lend Sony FE 24-70mm F2.8 GM II' })
  await lend.getByRole('textbox', { name: "Who's borrowing it" }).fill('Tama')
  await lend.getByLabel('Due back').fill(daysFromToday(7))
  await lend.getByRole('button', { name: 'Lend' }).click()
  await expect(lend).toBeHidden()
  await expect(page.getByRole('region', { name: 'On loan to Tama' })).toBeVisible()

  await page.getByRole('link', { name: 'Dashboard' }).click()
  const out = page.getByRole('region', { name: 'On loan' })
  await out.getByRole('link', { name: 'Sony FE 24-70mm F2.8 GM II' }).click()

  await page.getByRole('button', { name: 'Returned' }).click()
  const back = page.getByRole('dialog', { name: 'Sony FE 24-70mm F2.8 GM II is back' })
  await back.getByRole('button', { name: 'Mark as returned' }).click()
  await expect(back).toBeHidden()
  await expect(page.getByRole('region', { name: 'Earlier loans' })).toContainText('Tama')
  await expect(page.getByRole('region', { name: 'On loan to Tama' })).toHaveCount(0)
})
