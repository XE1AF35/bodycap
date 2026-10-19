// Shoots: logging one with the gear taken, and opening, editing, and deleting one, using only the
// keyboard.
import {
  expect,
  open,
  SAMPLE_COLLECTION,
  SAMPLE_GEAR,
  seed,
  seedGear,
  tabTo,
  test,
} from './fixtures'

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

test('opens a shoot, adds a kit to it, and deletes it using only the keyboard', async ({
  page,
}) => {
  await seed(page, SAMPLE_COLLECTION)
  await open(page, '#/shoots')
  const { keyboard } = page

  await tabTo(page, page.getByRole('link', { name: 'Street, Cuba Street' }))
  await keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Street, Cuba Street' })).toBeVisible()
  const taken = page.getByRole('region', { name: 'Items you took' }).getByRole('link')
  await expect(taken).toHaveText(['Fujifilm X-T5'])
  await expect(page.getByText('Rain.')).toBeVisible()

  await tabTo(page, page.getByRole('button', { name: 'Edit' }))
  await keyboard.press('Enter')
  const form = page.getByRole('dialog', { name: 'Edit Street, Cuba Street' })
  await tabTo(page, form.getByRole('combobox', { name: 'Kit' }))
  await keyboard.press('ArrowDown')
  await expect(form.getByRole('combobox', { name: 'Kit' })).toHaveValue(/.+/)
  await tabTo(page, form.getByRole('button', { name: 'Add its items' }))
  await keyboard.press('Enter')
  await expect(form.getByRole('status')).toHaveText('Added 2 items from Wedding kit.')
  await tabTo(page, form.getByRole('button', { name: 'Save' }))
  await keyboard.press('Enter')
  await expect(form).toBeHidden()
  await expect(taken).toHaveText([
    'Fujifilm X-T5',
    'Fujifilm XF 33mm F1.4 R LM WR',
    'Peak Design Everyday Backpack 20L',
  ])

  await tabTo(page, page.getByRole('button', { name: 'Delete' }))
  await keyboard.press('Enter')
  const confirm = page.getByRole('alertdialog', { name: 'Delete Street, Cuba Street?' })
  await tabTo(page, confirm.getByRole('button', { name: 'Delete' }))
  await keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Shoots' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Street, Cuba Street' })).toBeHidden()
  await expect(page.getByRole('link', { name: 'Wedding, Arrowtown' })).toBeVisible()
})
