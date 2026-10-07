// The add and edit gear form: saving, the error summary and field messages, fields that come and
// go with category and status, lens optics, currencies, duplicate serials, and the unsaved-changes
// guard.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GearFields } from '@/core/gear'
import type { Live } from '@/data/repositories'
import { renderApp, testServices } from './support'

const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  mount: 'sony-e',
  purchaseDate: '2026-03-01',
  purchasePrice: { amountMinor: 389900, currency: 'NZD' },
  status: 'owned',
}

/** The first value a live query gives */
function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}

const field = (name: string) => screen.getByRole('textbox', { name })
const select = (name: string) => screen.getByRole('combobox', { name })
const save = (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Save' }))

/** The add page, once the form has loaded */
async function renderAdd(services = testServices()) {
  const view = renderApp('/gear/new', services)
  await screen.findByRole('heading', { level: 1, name: 'Add gear' })
  return { ...view, user: userEvent.setup() }
}

async function fillBasics(user: UserEvent, category: string, brand: string, model: string) {
  await user.selectOptions(select('Category'), category)
  await user.type(field('Brand'), brand)
  await user.type(field('Model'), model)
}

describe('adding gear', () => {
  it('saves a new item and shows its page', async () => {
    const { user, services } = await renderAdd()
    await fillBasics(user, 'Lens', 'Sony', 'FE 24-70mm F2.8 GM II')
    await save(user)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sony FE 24-70mm F2.8 GM II' }),
    ).toBeInTheDocument()
    expect(await current(services.repositories.gear.list())).toMatchObject([
      { category: 'lens', brand: 'Sony', model: 'FE 24-70mm F2.8 GM II', status: 'owned' },
    ])
  })

  it('is reached from the gear list', async () => {
    const user = userEvent.setup()
    renderApp('/gear')
    await user.click(await screen.findByRole('link', { name: 'Add gear' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Add gear' })).toBeInTheDocument()
  })

  it('lists every problem in a summary that takes focus, and marks each field', async () => {
    const { user } = await renderAdd()
    await save(user)
    const summary = screen.getByRole('alert')
    expect(within(summary).getByRole('heading', { name: "There's a problem" })).toBeInTheDocument()
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Choose a category.', 'Enter the brand.', 'Enter the model.'])
    expect(summary).toHaveFocus()
    expect(field('Brand')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Brand')).toHaveAccessibleDescription('Error: Enter the brand.')
  })

  it('jumps to the field from its link in the summary', async () => {
    const { user } = await renderAdd()
    await save(user)
    await user.click(screen.getByRole('link', { name: 'Enter the brand.' }))
    expect(field('Brand')).toHaveFocus()
  })

  it('drops a message once its field is changed', async () => {
    const { user } = await renderAdd()
    await save(user)
    await user.type(field('Brand'), 'Sony')
    expect(field('Brand')).not.toHaveAttribute('aria-invalid')
    expect(
      within(screen.getByRole('alert'))
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Choose a category.', 'Enter the model.'])
  })

  it.each<[string, string[], string[]]>([
    ['Lens', ['Mount', 'Lens coverage'], ['Sensor format', 'Lens side']],
    ['Camera body', ['Mount', 'Sensor format'], ['Lens coverage', 'Camera side']],
    ['Mount adapter', ['Lens side', 'Camera side'], ['Mount', 'Sensor format']],
    ['Tripod', [], ['Mount', 'Sensor format', 'Lens coverage', 'Lens side']],
  ])('shows the spec fields for a %s', async (category, shown, hidden) => {
    const { user } = await renderAdd()
    await user.selectOptions(select('Category'), category)
    for (const name of shown) expect(select(name)).toBeInTheDocument()
    for (const name of hidden)
      expect(screen.queryByRole('combobox', { name })).not.toBeInTheDocument()
  })

  it.each([
    ['Lens', true],
    ['Camera body', false],
    ['Mount adapter', false],
  ])('asks for focal length and aperture for a %s only if it is a lens', async (category, asks) => {
    const { user } = await renderAdd()
    await user.selectOptions(select('Category'), category)
    const group = screen.queryByRole('group', { name: 'Focal length and aperture' })
    expect(group !== null).toBe(asks)
  })

  it("saves a lens's focal length and aperture as typed, and shows them on its page", async () => {
    const { user, services } = await renderAdd()
    await fillBasics(user, 'Lens', 'Fujifilm', 'XF 18-55mm F2.8-4')
    await user.type(field('Shortest focal length'), '18')
    await user.type(field('Longest focal length'), '55 mm')
    await user.type(field('Widest aperture'), 'f/2.8')
    await user.type(field('Widest aperture at the long end'), '4')
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Fujifilm XF 18-55mm F2.8-4' })
    const shown = (label: string) =>
      screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
    expect([shown('Focal length'), shown('Aperture')]).toEqual(['18-55mm', 'f/2.8-4'])
    expect(await current(services.repositories.gear.list())).toMatchObject([
      { focalLengthMin: 18, focalLengthMax: 55, maxAperture: 2.8, maxApertureTele: 4 },
    ])
  })

  it('explains a focal length range typed the wrong way round, at the field and in the summary', async () => {
    const { user } = await renderAdd()
    await fillBasics(user, 'Lens', 'Sony', 'FE 24-70mm F2.8 GM II')
    await user.type(field('Shortest focal length'), '70')
    await user.type(field('Longest focal length'), '24')
    await save(user)
    const message = "The longest focal length can't be shorter than the shortest."
    expect(within(screen.getByRole('alert')).getByRole('link', { name: message })).toBeVisible()
    expect(field('Longest focal length')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Longest focal length')).toHaveAccessibleDescription(
      /Error: The longest focal length can't be shorter than the shortest\.$/,
    )
  })

  it('asks whether autofocus works through an adapter', async () => {
    const { user } = await renderAdd()
    await fillBasics(user, 'Mount adapter', 'Nikon', 'FTZ II')
    await user.selectOptions(select('Lens side'), 'Nikon F')
    await user.selectOptions(select('Camera side'), 'Nikon Z')
    await user.click(screen.getByRole('checkbox', { name: 'Autofocus works through it' }))
    await save(user)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nikon FTZ II' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Autofocus', { selector: 'dt' }).nextElementSibling).toHaveTextContent(
      'Yes',
    )
  })

  it('asks for the sale details once the status is sold, and requires them', async () => {
    const { user } = await renderAdd()
    await fillBasics(user, 'Lens', 'Sony', 'FE 85mm F1.8')
    expect(screen.queryByLabelText('Sale date')).not.toBeInTheDocument()
    await user.selectOptions(select('Status'), 'Sold')
    expect(screen.getByLabelText('Sale date')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Sale price' })).toBeInTheDocument()
    await save(user)
    expect(
      within(screen.getByRole('alert'))
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Enter the date it was sold.', 'Enter what it sold for.'])
  })

  it('asks for the date when the status is lost', async () => {
    const { user } = await renderAdd()
    await user.selectOptions(select('Status'), 'Lost')
    expect(screen.getByLabelText('Date lost')).toBeInTheDocument()
  })

  it('leaves out the serial and warranty for something not bought yet', async () => {
    const { user } = await renderAdd()
    await user.selectOptions(select('Status'), 'Wishlist')
    expect(screen.queryByRole('textbox', { name: 'Serial number' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Warranty and insurance' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Purchase price' })).toBeInTheDocument()
  })

  it('starts every amount in NZD, or in the last currency used', async () => {
    const first = await renderAdd()
    const currency = () =>
      within(screen.getByRole('group', { name: 'Purchase price' })).getByRole('combobox', {
        name: 'Currency',
      })
    expect(currency()).toHaveValue('NZD')
    first.unmount()

    const services = testServices()
    await services.repositories.settings.setLastUsedCurrency('AUD')
    await renderAdd(services)
    expect(currency()).toHaveValue('AUD')
  })

  it('remembers the currency of an amount it saves', async () => {
    const { user, services } = await renderAdd()
    await fillBasics(user, 'Lens', 'Sigma', '35mm F1.4 DG DN Art')
    const price = within(screen.getByRole('group', { name: 'Purchase price' }))
    await user.type(price.getByRole('textbox', { name: 'Amount' }), '1,599')
    await user.selectOptions(price.getByRole('combobox', { name: 'Currency' }), 'USD')
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Sigma 35mm F1.4 DG DN Art' })
    await waitFor(async () => {
      expect(await current(services.repositories.settings.get())).toMatchObject({
        lastUsedCurrency: 'USD',
      })
    })
  })

  it('asks the browser to keep the data after saving', async () => {
    const persist = vi.fn(() => Promise.resolve(true))
    const services = testServices()
    const { user } = await renderAdd({
      ...services,
      storage: { requestPersistence: persist, storageState: () => Promise.resolve({}) },
    })
    await fillBasics(user, 'Bag', 'Peak Design', 'Sling 6L')
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Peak Design Sling 6L' })
    expect(persist).toHaveBeenCalledOnce()
  })

  it('warns about a serial already used for that brand, but still saves', async () => {
    const services = testServices()
    await services.repositories.gear.add({ ...lens, brand: 'Canon', serialNumber: '0123-4567' })
    const { user } = await renderAdd(services)
    await fillBasics(user, 'Lens', 'Canon', 'RF 50mm F1.8 STM')
    await user.type(field('Serial number'), '01234567')
    const warning = screen.getByText(/Another Canon item has this serial number/)
    expect(
      within(warning).getByRole('link', { name: 'Canon FE 24-70mm F2.8 GM II' }),
    ).toBeInTheDocument()
    expect(field('Serial number')).toHaveAccessibleDescription(
      /Another Canon item has this serial number/,
    )
    await save(user)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Canon RF 50mm F1.8 STM' }),
    ).toBeInTheDocument()
  })

  it('asks before leaving with unsaved changes', async () => {
    const { user } = await renderAdd()
    await user.type(field('Brand'), 'Sony')
    await user.click(screen.getByRole('link', { name: 'Dashboard' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Leave without saving?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Add gear' })).toBeInTheDocument()
    expect(field('Brand')).toHaveValue('Sony')

    await user.click(screen.getByRole('link', { name: 'Dashboard' }))
    const again = await screen.findByRole('alertdialog', { name: 'Leave without saving?' })
    await user.click(within(again).getByRole('button', { name: 'Leave' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome to Bodycap' }),
    ).toBeInTheDocument()
  })

  it('leaves without asking when nothing has changed', async () => {
    const { user } = await renderAdd()
    await user.click(screen.getByRole('link', { name: 'Dashboard' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome to Bodycap' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('editing gear', () => {
  async function renderEdit(fields: GearFields = lens) {
    const services = testServices()
    const item = await services.repositories.gear.add(fields)
    const view = renderApp(`/gear/${item.id}/edit`, services)
    await screen.findByRole('heading', { level: 1, name: `Edit ${fields.brand} ${fields.model}` })
    return { ...view, item, user: userEvent.setup() }
  }

  it('is reached from the item page', async () => {
    const user = userEvent.setup()
    const services = testServices()
    const item = await services.repositories.gear.add(lens)
    renderApp(`/gear/${item.id}`, services)
    await user.click(await screen.findByRole('link', { name: 'Edit' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit Sony FE 24-70mm F2.8 GM II' }),
    ).toBeInTheDocument()
  })

  it('starts from what is saved, and saves the changes', async () => {
    const { user, item, services } = await renderEdit()
    expect(field('Brand')).toHaveValue('Sony')
    expect(screen.getByLabelText('Purchase date')).toHaveValue('2026-03-01')
    const price = within(screen.getByRole('group', { name: 'Purchase price' }))
    expect(price.getByRole('textbox', { name: 'Amount' })).toHaveValue('3899.00')

    await user.clear(field('Model'))
    await user.type(field('Model'), 'FE 24-70mm F2.8 GM')
    await save(user)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sony FE 24-70mm F2.8 GM' }),
    ).toBeInTheDocument()
    expect(await current(services.repositories.gear.get(item.id))).toMatchObject({
      model: 'FE 24-70mm F2.8 GM',
      purchasePrice: { amountMinor: 389900, currency: 'NZD' },
    })
  })

  it("fills in a lens's focal length and aperture", async () => {
    await renderEdit({ ...lens, focalLengthMin: 24, focalLengthMax: 70, maxAperture: 2.8 })
    expect(
      ['Shortest focal length', 'Longest focal length', 'Widest aperture'].map(
        (name) => (field(name) as HTMLInputElement).value,
      ),
    ).toEqual(['24', '70', '2.8'])
    expect(field('Widest aperture at the long end')).toHaveValue('')
  })

  // Lending and returning also record the loan, so they're done with the item's status buttons
  it.each<[GearFields['status'], string[]]>([
    ['sold', ['Owned', 'Sold']],
    ['owned', ['Owned', 'In repair', 'Sold', 'Lost']],
    ['lent-out', ['Lent out', 'Lost']],
    ['wishlist', ['Owned', 'Wishlist']],
  ])('offers only the changes the lifecycle allows from %s', async (status, choices) => {
    const fields: GearFields =
      status === 'sold'
        ? {
            ...lens,
            status,
            saleDate: '2026-09-20',
            salePrice: { amountMinor: 1, currency: 'NZD' },
          }
        : status === 'wishlist'
          ? { category: 'lens', brand: 'Sony', model: 'FE 50mm F1.4 GM', status }
          : { ...lens, status }
    await renderEdit(fields)
    const options = within(select('Status')).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(choices)
  })

  it('says so when the item was deleted elsewhere before saving', async () => {
    const { user, item, services } = await renderEdit()
    await user.type(field('Nickname'), 'Workhorse')
    await services.repositories.gear.remove(item.id)
    await save(user)
    expect(
      await screen.findByText(
        "This item was deleted, perhaps in another tab, so your changes weren't saved.",
      ),
    ).toBeInTheDocument()
  })
})
