// Model suggestions in the gear form: known models found as you type, and picking one fills in the
// facts about it while leaving everything about your own copy alone.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from './support'

const textbox = (name: string) => screen.getByRole('textbox', { name })
const select = (name: string) => screen.getByRole('combobox', { name })
const model = () => screen.getByRole('combobox', { name: /^Model/ })

async function renderAdd() {
  renderApp('/gear/new')
  await screen.findByRole('heading', { level: 1, name: 'Add gear' })
  return userEvent.setup()
}

describe('model suggestions', () => {
  it('suggests known models as you type, saying what each is', async () => {
    const user = await renderAdd()
    await user.selectOptions(select('Category'), 'Camera body')
    await user.type(model(), 'a7 iv')
    const option = await screen.findByRole('option', { name: /a7 IV/ })
    expect(option).toHaveTextContent('Sony a7 IV')
    expect(option).toHaveTextContent('Camera body')
    expect(option).toHaveTextContent('E mount')
    expect(option).toHaveTextContent('Full frame')
    expect(await screen.findByText(/models? found/)).toHaveAttribute('role', 'status')
  })

  it('keeps its name while the open suggestions hide the rest of the form', async () => {
    const user = await renderAdd()
    await user.type(model(), 'a7 iv')
    await screen.findByRole('option', { name: /a7 IV/ })
    // The label is hidden along with everything else, which only aria-labelledby looks past
    const label = document.getElementById(model().getAttribute('aria-labelledby') ?? '')
    expect(label).toHaveTextContent(/^Model/)
    expect(label?.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('fills in a camera body picked by keyboard, and says what it filled', async () => {
    const user = await renderAdd()
    await user.type(textbox('Nickname'), 'Main body')
    await user.type(model(), 'sony a7 iv')
    await screen.findByRole('option', { name: /a7 IV/ })
    await user.keyboard('{ArrowDown}{Enter}')

    expect(model()).toHaveValue('a7 IV')
    expect(select('Category')).toHaveValue('camera-body')
    expect(textbox('Brand')).toHaveValue('Sony')
    expect(select('Mount')).toHaveValue('sony-e')
    expect(select('Sensor format')).toHaveValue('full-frame')
    expect(textbox('Nickname')).toHaveValue('Main body')
    expect(
      screen.getByText(/Filled in the category, brand, mount, and sensor format/),
    ).toHaveAttribute('role', 'status')
  })

  it('fills in a lens with its focal lengths and apertures', async () => {
    const user = await renderAdd()
    await user.selectOptions(select('Category'), 'Lens')
    await user.type(model(), '24-70 2.8 gm ii')
    await user.click(await screen.findByRole('option', { name: /FE 24-70mm F2.8 GM II/ }))

    expect(textbox('Brand')).toHaveValue('Sony')
    expect(select('Lens coverage')).toHaveValue('full-frame')
    expect(textbox('Shortest focal length')).toHaveValue('24')
    expect(textbox('Longest focal length')).toHaveValue('70')
    expect(textbox('Widest aperture')).toHaveValue('2.8')
    expect(textbox('Widest aperture at the long end')).toHaveValue('')
    expect(textbox('Filter thread')).toHaveValue('82')
    expect(textbox('Weight')).toHaveValue('695')
    expect(
      screen.getByText(/focal length, aperture, filter thread, and weight/),
    ).toBeInTheDocument()
  })

  it('shows only the chosen category', async () => {
    const user = await renderAdd()
    await user.selectOptions(select('Category'), 'Lens')
    await user.type(model(), 'sony a7')
    expect(await screen.findByText(/No known model matches/)).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('suggests nothing for categories the catalogue has no models for', async () => {
    const user = await renderAdd()
    await user.selectOptions(select('Category'), 'Tripod')
    await user.type(model(), 'sony a7')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('keeps a model typed by hand when nothing is picked', async () => {
    const user = await renderAdd()
    await user.type(model(), 'Homemade pinhole')
    await user.keyboard('{Escape}')
    expect(model()).toHaveValue('Homemade pinhole')
    expect(textbox('Brand')).toHaveValue('')
  })

  it('lets you change a filled-in value afterwards', async () => {
    const user = await renderAdd()
    await user.type(model(), 'a7 iv')
    await user.click(await screen.findByRole('option', { name: /a7 IV/ }))
    await user.selectOptions(select('Mount'), 'l-mount')
    expect(select('Mount')).toHaveValue('l-mount')
    const summary = screen.queryByRole('alert')
    expect(summary === null || within(summary).queryByText(/mount/i) === null).toBe(true)
  })
})
