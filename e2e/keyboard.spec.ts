// Adding, editing, and deleting gear with only a keyboard: Tab to move, Enter to act, and typing to
// fill fields and choose from lists.
import { expect, open, tabTo, test } from './fixtures'

test('adds, edits, and deletes an item using only the keyboard', async ({ page }) => {
  await open(page)
  const { keyboard } = page

  // Add, from the welcome screen
  await tabTo(page, page.getByRole('link', { name: 'Add your first item' }))
  await keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Add gear' })).toBeFocused()

  await tabTo(page, page.getByRole('combobox', { name: 'Category' }))
  await keyboard.type('Lens')
  await expect(page.getByRole('combobox', { name: 'Category' })).toHaveValue('lens')
  await tabTo(page, page.getByRole('textbox', { name: 'Brand' }))
  await keyboard.type('Sony')
  await tabTo(page, page.getByRole('textbox', { name: 'Model' }))
  await keyboard.type('FE 24-70mm F2.8 GM')
  await tabTo(page, page.getByRole('button', { name: 'Save' }))
  await keyboard.press('Enter')
  const added = page.getByRole('heading', { level: 1, name: 'Sony FE 24-70mm F2.8 GM' })
  await expect(added).toBeFocused()

  // Edit
  await tabTo(page, page.getByRole('link', { name: 'Edit' }))
  await keyboard.press('Enter')
  await tabTo(page, page.getByRole('textbox', { name: 'Model' }))
  await keyboard.press('End')
  await keyboard.type(' II')
  await tabTo(page, page.getByRole('button', { name: 'Save' }))
  await keyboard.press('Enter')
  const edited = page.getByRole('heading', { level: 1, name: 'Sony FE 24-70mm F2.8 GM II' })
  await expect(edited).toBeFocused()

  // Delete, confirming in the dialog
  await tabTo(page, page.getByRole('button', { name: 'Delete' }))
  await keyboard.press('Enter')
  const dialog = page.getByRole('alertdialog', { name: 'Delete Sony FE 24-70mm F2.8 GM II?' })
  await expect(dialog).toBeVisible()
  await tabTo(page, dialog.getByRole('button', { name: 'Delete' }))
  await keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Gear' })).toBeFocused()
  await expect(page.getByText("You haven't added any gear yet.")).toBeVisible()
})

test('skips to the main content from the first Tab', async ({ page }) => {
  await open(page, '#/settings')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page).toHaveURL(/#\/settings$/)
})
