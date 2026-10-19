// Shoots on screen: the empty log, logging a shoot with its items, every rule's message, the log
// newest first with how many shoots this year, and a shoot's own page.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { toIsoDate } from '@/core/dates'
import type { GearFields } from '@/core/gear'
import { addToKit } from '@/core/kits'
import type { Live } from '@/data/repositories'
import { renderApp, testServices } from './support'

const camera: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T5',
  mount: 'fujifilm-x',
  status: 'owned',
}
const lens: GearFields = {
  category: 'lens',
  brand: 'Fujifilm',
  model: 'XF 33mm F1.4',
  mount: 'fujifilm-x',
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

const today = toIsoDate(new Date())
const year = Number(today.slice(0, 4))

describe('the shoots page', () => {
  it('explains shoots when there are none yet', async () => {
    renderApp('/shoots')
    expect(await screen.findByText('No shoots yet.')).toBeVisible()
    expect(screen.getByText(/A shoot is a time you went out photographing/)).toBeVisible()
  })

  it("lists shoots newest first with their dates and items, and counts this year's", async () => {
    const services = testServices()
    const a = await services.repositories.gear.add(camera)
    const b = await services.repositories.gear.add(lens)
    const shoots = services.repositories.shoots
    await shoots.add({
      date: `${String(year - 1)}-12-31`,
      name: 'New Year fireworks',
      gearIds: [a.id],
    })
    await shoots.add({ date: `${String(year)}-01-01`, name: 'Sunrise walk', gearIds: [] })
    await shoots.add({ date: today, name: 'Wedding, Arrowtown', gearIds: [a.id, b.id] })
    renderApp('/shoots', services)
    const list = within(await screen.findByRole('list', { name: 'Your shoots' }))
    expect(list.getAllByRole('listitem').map((card) => card.textContent)).toEqual([
      expect.stringMatching(/^Wedding, Arrowtown.*2 items$/),
      expect.stringMatching(/^Sunrise walk1 Jan \d{4}No items$/),
      expect.stringMatching(/^New Year fireworks31 Dec \d{4}1 item$/),
    ])
    expect(screen.getByText('2 shoots logged this year.')).toBeVisible()
  })

  it('logs a shoot with the items picked, from every category but the wishlist', async () => {
    const services = testServices()
    await services.repositories.gear.add(camera)
    await services.repositories.gear.add(lens)
    await services.repositories.gear.add({
      category: 'tripod',
      brand: 'Peak Design',
      model: 'Travel Tripod',
      status: 'sold',
      saleDate: '2026-01-01',
    })
    await services.repositories.gear.add({ ...lens, model: 'XF 56mm F1.2', status: 'wishlist' })
    const user = userEvent.setup()
    renderApp('/shoots', services)
    await user.click(await screen.findByRole('button', { name: 'Log a shoot' }))
    const form = within(await screen.findByRole('dialog', { name: 'Log a shoot' }))
    expect(form.getByLabelText(/^Date/)).toHaveValue(today)
    expect(form.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual([
      'Fujifilm X-T5',
      'Fujifilm XF 33mm F1.4',
      'Peak Design Travel Tripod',
    ])
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Wedding, Arrowtown')
    await user.type(form.getByRole('searchbox', { name: 'Search' }), 'x-t5')
    await user.click(form.getByRole('checkbox', { name: 'Fujifilm X-T5' }))
    await user.clear(form.getByRole('searchbox', { name: 'Search' }))
    await user.click(form.getByRole('checkbox', { name: 'Peak Design Travel Tripod' }))
    await user.type(form.getByRole('textbox', { name: 'Notes' }), 'Rain all day.')
    await user.click(form.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    const list = within(await screen.findByRole('list', { name: 'Your shoots' }))
    expect(list.getByRole('listitem')).toHaveTextContent(/^Wedding, Arrowtown.*2 items$/)
    expect(screen.getByText('1 shoot logged this year.')).toBeVisible()
  })

  it('says what to fix in every field, and saves nothing until it is fixed', async () => {
    const user = userEvent.setup()
    renderApp('/shoots')
    await user.click(await screen.findByRole('button', { name: 'Log a shoot' }))
    const form = within(await screen.findByRole('dialog', { name: 'Log a shoot' }))
    await user.clear(form.getByLabelText(/^Date/))
    await user.click(form.getByRole('textbox', { name: 'Notes' }))
    await user.paste('a'.repeat(2001))
    await user.click(form.getByRole('button', { name: 'Save' }))
    expect(form.getByLabelText(/^Date/)).toHaveAccessibleDescription(
      'Error: Enter the date of the shoot.',
    )
    expect(form.getByLabelText(/^Date/)).toHaveFocus()
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      /Error: Enter a name for the shoot\.$/,
    )
    expect(form.getByRole('textbox', { name: 'Notes' })).toHaveAccessibleDescription(
      'Error: Keep the notes to 2,000 characters or fewer.',
    )
    await user.type(form.getByLabelText(/^Date/), `${String(year + 1)}-01-01`)
    await user.click(form.getByRole('button', { name: 'Save' }))
    expect(form.getByLabelText(/^Date/)).toHaveAccessibleDescription(
      "Error: The date can't be in the future.",
    )
    expect(screen.getByText('No shoots yet.')).toBeInTheDocument()
  })
})

describe("a shoot's page", () => {
  /** The Shoots page with the camera, lens, and a kit saved, and one shoot taking the camera */
  async function renderShoot() {
    const services = testServices()
    const { repositories } = services
    const a = await repositories.gear.add(camera)
    const b = await repositories.gear.add(lens)
    const shoot = await repositories.shoots.add({
      date: '2026-03-14',
      name: 'Wedding, Arrowtown',
      gearIds: [b.id, a.id],
      notes: 'Rain all day.\nDried off at the hall.',
    })
    renderApp('/shoots', services)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: 'Wedding, Arrowtown' }))
    await screen.findByRole('heading', { level: 1, name: 'Wedding, Arrowtown' })
    return { services, shoot, items: [a, b], user }
  }

  const taken = () => within(screen.getByRole('region', { name: 'Items you took' }))

  it('shows the date, the items linked to their pages, and the notes', async () => {
    const { items } = await renderShoot()
    expect(screen.getByText('14 Mar 2026')).toBeVisible()
    expect(
      taken()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Fujifilm XF 33mm F1.4', 'Fujifilm X-T5'])
    expect(taken().getByRole('link', { name: 'Fujifilm X-T5' })).toHaveAttribute(
      'href',
      `/gear/${items[0]?.id ?? ''}`,
    )
    expect(screen.getByText(/^Rain all day\.\s+Dried off at the hall\.$/)).toBeVisible()
  })

  it('drops an item once it is deleted', async () => {
    const { services, items } = await renderShoot()
    await services.repositories.gear.remove(items[1]?.id ?? '')
    await waitFor(() => {
      expect(
        taken()
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['Fujifilm X-T5'])
    })
  })

  it('edits the date, name, items, and notes through the same rules', async () => {
    const { user } = await renderShoot()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const form = within(await screen.findByRole('dialog', { name: 'Edit Wedding, Arrowtown' }))
    expect(form.getByLabelText(/^Date/)).toHaveValue('2026-03-14')
    expect(form.getByRole('checkbox', { name: 'Fujifilm X-T5' })).toBeChecked()
    expect(form.getByRole('checkbox', { name: 'Fujifilm XF 33mm F1.4' })).toBeChecked()
    expect(form.getByRole('textbox', { name: 'Notes' })).toHaveValue(
      'Rain all day.\nDried off at the hall.',
    )
    await user.clear(form.getByLabelText(/^Date/))
    await user.type(form.getByLabelText(/^Date/), `${String(year + 1)}-01-01`)
    await user.click(form.getByRole('button', { name: 'Save' }))
    expect(form.getByLabelText(/^Date/)).toHaveAccessibleDescription(
      "Error: The date can't be in the future.",
    )
    await user.clear(form.getByLabelText(/^Date/))
    await user.type(form.getByLabelText(/^Date/), '2026-03-15')
    await user.clear(form.getByRole('textbox', { name: 'Name' }))
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Wedding, Wānaka')
    await user.click(form.getByRole('checkbox', { name: 'Fujifilm XF 33mm F1.4' }))
    await user.clear(form.getByRole('textbox', { name: 'Notes' }))
    await user.click(form.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Wedding, Wānaka' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('15 Mar 2026')).toBeVisible()
    expect(
      taken()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Fujifilm X-T5'])
    expect(screen.queryByRole('region', { name: 'Notes' })).not.toBeInTheDocument()
  })

  it("adds every item in a kit that isn't already on the shoot", async () => {
    const { services, items, user } = await renderShoot()
    const flash = await services.repositories.gear.add({
      category: 'flash',
      brand: 'Godox',
      model: 'V1',
      status: 'owned',
    })
    const wanted = await services.repositories.gear.add({
      ...lens,
      model: 'XF 56mm F1.2',
      status: 'wishlist',
    })
    const kit = await services.repositories.kits.add({ name: 'Travel light' })
    await services.repositories.kits.update(kit.id, (saved) =>
      addToKit(saved, [flash.id, items[1]?.id ?? '', wanted.id]),
    )
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const form = within(await screen.findByRole('dialog', { name: 'Edit Wedding, Arrowtown' }))
    await user.click(form.getByRole('button', { name: 'Add its items' }))
    expect(form.getByRole('combobox', { name: 'Kit' })).toHaveAccessibleDescription(
      /Error: Choose a kit to add\.$/,
    )
    expect(form.getByRole('combobox', { name: 'Kit' })).toHaveFocus()
    await user.selectOptions(form.getByRole('combobox', { name: 'Kit' }), 'Travel light')
    await user.click(form.getByRole('button', { name: 'Add its items' }))
    expect(form.getByRole('status')).toHaveTextContent('Added 1 item from Travel light.')
    expect(form.getByRole('checkbox', { name: 'Godox V1' })).toBeChecked()
    await user.click(form.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(
      taken()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Fujifilm XF 33mm F1.4', 'Fujifilm X-T5', 'Godox V1'])
  })

  it('deletes the shoot after confirming, keeping its items, and goes back to Shoots', async () => {
    const { services, user } = await renderShoot()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const confirm = within(
      await screen.findByRole('alertdialog', { name: 'Delete Wedding, Arrowtown?' }),
    )
    await user.click(confirm.getByRole('button', { name: 'Keep it' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Wedding, Arrowtown' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Shoots' })).toBeInTheDocument()
    expect(await screen.findByText('No shoots yet.')).toBeVisible()
    expect(await current(services.repositories.gear.list())).toHaveLength(2)
  })

  it('says when the shoot is not there', async () => {
    renderApp('/shoots/6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90')
    expect(await screen.findByRole('heading', { level: 1, name: 'Shoot not found' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to shoots' })).toBeVisible()
  })
})
