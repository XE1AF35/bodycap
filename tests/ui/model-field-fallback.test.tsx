// The Model field when the gear catalogue can't load: it works as a plain text field, and the item
// still saves.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from './support'

vi.mock('@/core/catalogue/data', () => {
  throw new Error('The catalogue chunk failed to load')
})

describe('model suggestions without the catalogue', () => {
  it('lets the model be typed and saved by hand', async () => {
    const user = userEvent.setup()
    renderApp('/gear/new')
    await screen.findByRole('heading', { level: 1, name: 'Add gear' })
    await user.selectOptions(screen.getByRole('combobox', { name: /^Category/ }), 'Camera body')
    await user.type(screen.getByRole('textbox', { name: /^Brand/ }), 'Sony')
    const model = screen.getByRole('combobox', { name: /^Model/ })
    await user.type(model, 'a7 IV')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Sony a7 IV' })).toBeInTheDocument()
  })
})
