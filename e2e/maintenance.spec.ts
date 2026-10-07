// Maintenance: logging work on an item, and adding up what it has cost.
import { expect, open, SAMPLE_GEAR, seedGear, test } from './fixtures'

test('logs work on an item and adds up what it cost', async ({ page }) => {
  await seedGear(page, SAMPLE_GEAR)
  await open(page, '#/gear')
  await page.getByRole('table').getByRole('link', { name: 'Fujifilm X-T5' }).click()

  await page.getByRole('button', { name: 'Log work' }).click()
  const form = page.getByRole('dialog', { name: 'Log work on Fujifilm X-T5' })
  await form
    .getByRole('combobox', { name: 'What was done' })
    .selectOption({ label: 'Firmware update' })
  await form.getByRole('textbox', { name: 'Firmware version' }).fill('5.10')
  await form
    .getByRole('group', { name: 'Cost' })
    .getByRole('textbox', { name: 'Amount' })
    .fill('45')
  await form.getByRole('textbox', { name: 'Who did it' }).fill('Camera Clinic')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(form).toBeHidden()

  const log = page.getByRole('region', { name: 'Maintenance' })
  await expect(log).toContainText('Firmware update')
  await expect(log).toContainText('5.10')
  await expect(log).toContainText('Spent so far: $45.00')
})
