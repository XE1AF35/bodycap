// Shoots and the Money page together: a shoot logged by keyboard shows in the item's usage, and the
// item's cost and estimated value show on the Money page.
import { expect, open, SAMPLE_GEAR, seedGear, tabTo, test } from './fixtures'

/** Text to match exactly inside a regular expression */
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('logs a shoot, then sees its usage and the money it adds up to', async ({ page }) => {
  await seedGear(page, SAMPLE_GEAR)
  await open(page, '#/shoots')
  const { keyboard } = page

  await tabTo(page, page.getByRole('button', { name: 'Log a shoot' }))
  await keyboard.press('Enter')
  const form = page.getByRole('dialog', { name: 'Log a shoot' })
  await tabTo(page, form.getByRole('textbox', { name: 'Name' }))
  await keyboard.type('Dawn at Muriwai')
  await tabTo(page, form.getByRole('checkbox', { name: 'Sony FE 24-70mm F2.8 GM II' }))
  await keyboard.press('Space')
  await tabTo(page, form.getByRole('button', { name: 'Save' }))
  await keyboard.press('Enter')
  await expect(form).toBeHidden()

  await tabTo(page, page.getByRole('link', { name: 'Dawn at Muriwai' }))
  await keyboard.press('Enter')
  await tabTo(page, page.getByRole('link', { name: 'Sony FE 24-70mm F2.8 GM II' }))
  await keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sony FE 24-70mm F2.8 GM II' }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Usage' })).toHaveText(
    /Used on 1 shoot, on \d{1,2} \S+ \d{4}\./,
  )
  // The item page and the Money page work the estimate out the same way
  const estimate = page
    .getByRole('definition')
    .filter({ hasText: 'Worked out from its price and age' })
    .getByText(/^\$[\d,]+\.\d{2}$/)
  const value = escape(await estimate.innerText())

  await tabTo(
    page,
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Money' }),
  )
  await keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Money' })).toBeVisible()
  const spend = page.getByRole('table', { name: 'Spend by year in NZD' })
  await expect(spend.getByRole('row', { name: /^2026/ })).toHaveText(/\$3,899\.00/)
  await expect(spend.getByRole('row', { name: /^No purchase date/ })).toHaveText(/\$2,999\.00/)

  const estimates = page.getByRole('table', { name: 'Estimated value in NZD' })
  await expect(estimates.getByRole('row', { name: /^Sony FE 24-70mm/ })).toHaveText(
    new RegExp(`\\$3,899\\.00.*${value}`),
  )
  await expect(estimates.getByRole('row', { name: /^Total/ })).toHaveText(new RegExp(`${value}$`))
  await expect(
    page.getByText("1 item has no purchase date, so the estimate doesn't include it."),
  ).toBeVisible()
})
