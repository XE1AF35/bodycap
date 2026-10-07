// Kits on screen: the list, making a kit, adding gear, the packing checklist on and off, ticking,
// unpacking, removing, renaming, deleting, and which kits an item is in.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { GearFields } from '@/core/gear'
import { addToKit, setChecklist, setPacked } from '@/core/kits'
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
const sold: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T3',
  status: 'sold',
  saleDate: '2026-01-01',
  salePrice: { amountMinor: 100000, currency: 'NZD' },
}
const wanted: GearFields = {
  category: 'lens',
  brand: 'Fujifilm',
  model: 'XF 56mm F1.2',
  status: 'wishlist',
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

/** A kit's page, with the camera and lens saved and the kit holding the given gear */
async function renderKit(holding: 'nothing' | 'both' = 'both', checklist = false) {
  const services = testServices()
  const items = [
    await services.repositories.gear.add(camera),
    await services.repositories.gear.add(lens),
  ]
  await services.repositories.gear.add(sold)
  await services.repositories.gear.add(wanted)
  const kit = await services.repositories.kits.add({ name: 'Travel light' })
  await services.repositories.kits.update(kit.id, (saved) =>
    setChecklist(addToKit(saved, holding === 'both' ? items.map(({ id }) => id) : []), checklist),
  )
  renderApp(`/kits/${kit.id}`, services)
  await screen.findByRole('heading', { level: 1, name: 'Travel light' })
  return { services, kit, items, user: userEvent.setup() }
}

const contents = () => within(screen.getByRole('region', { name: 'In this kit' }))

describe('the kits page', () => {
  it('explains kits when there are none yet', async () => {
    renderApp('/kits')
    expect(await screen.findByText('No kits yet.')).toBeVisible()
  })

  it('makes a kit, asking for a name first, then opens it', async () => {
    const user = userEvent.setup()
    renderApp('/kits')
    await user.click(await screen.findByRole('button', { name: 'New kit' }))
    const form = within(await screen.findByRole('dialog', { name: 'New kit' }))
    await user.click(form.getByRole('button', { name: 'Create kit' }))
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      /Error: Enter a name for the kit\.$/,
    )
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Wedding')
    await user.type(form.getByRole('textbox', { name: 'Description' }), 'Two bodies, one flash.')
    await user.click(form.getByRole('button', { name: 'Create kit' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Wedding' })).toBeInTheDocument()
    expect(screen.getByText('Two bodies, one flash.')).toBeVisible()
  })

  it('lists each kit with how much is in it and how much is packed', async () => {
    const services = testServices()
    const a = await services.repositories.gear.add(camera)
    const b = await services.repositories.gear.add(lens)
    const travel = await services.repositories.kits.add({ name: 'Travel light' })
    await services.repositories.kits.update(travel.id, (saved) =>
      setPacked(setChecklist(addToKit(saved, [a.id, b.id]), true), a.id, true),
    )
    await services.repositories.kits.add({ name: 'Studio' })
    renderApp('/kits', services)
    const list = within(await screen.findByRole('list', { name: 'Your kits' }))
    const cards = list.getAllByRole('listitem')
    expect(cards.map((card) => within(card).getByRole('link').textContent)).toEqual([
      'Studio',
      'Travel light',
    ])
    expect(cards[0]).toHaveTextContent('Nothing in it yet')
    expect(cards[1]).toHaveTextContent('2 items')
    expect(cards[1]).toHaveTextContent('1 of 2 packed')
  })
})

describe('a kit', () => {
  it('adds gear from a picker that leaves out sold and lost gear', async () => {
    const { user, services, kit } = await renderKit('nothing')
    expect(contents().getByText('Nothing in this kit yet.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Add gear' }))
    const picker = within(await screen.findByRole('dialog', { name: 'Add gear to Travel light' }))
    expect(picker.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual(
      ['Fujifilm X-T5', 'Fujifilm XF 33mm F1.4', 'Fujifilm XF 56mm F1.2'],
    )
    await user.type(picker.getByRole('searchbox', { name: 'Search' }), '33mm')
    await user.click(picker.getByRole('checkbox', { name: 'Fujifilm XF 33mm F1.4' }))
    await user.click(picker.getByRole('button', { name: 'Add to kit' }))
    // The rest of the page is hidden from screen readers until the dialog has gone
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(await contents().findByRole('link', { name: 'Fujifilm XF 33mm F1.4' })).toBeVisible()
    expect((await current(services.repositories.kits.get(kit.id)))?.gearIds).toHaveLength(1)
  })

  it('ticks items off as they are packed, counts them, and unpacks everything', async () => {
    const { user } = await renderKit('both')
    await user.click(screen.getByRole('checkbox', { name: 'Use as a packing checklist' }))
    const boxes = await contents().findAllByRole('checkbox')
    expect(boxes.map((box) => box.closest('label')?.textContent)).toEqual([
      'Fujifilm X-T5',
      'Fujifilm XF 33mm F1.4',
    ])
    await user.click(contents().getByRole('checkbox', { name: 'Fujifilm X-T5' }))
    expect(await screen.findByText('1 of 2 packed')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Unpack all' }))
    expect(await screen.findByText('0 of 2 packed')).toBeVisible()
    expect(contents().getByRole('checkbox', { name: 'Fujifilm X-T5' })).not.toBeChecked()
  })

  it('forgets the ticks when the checklist is turned off', async () => {
    const { user, services, kit, items } = await renderKit('both', true)
    const [first] = items
    if (first === undefined) throw new Error('No gear')
    await services.repositories.kits.update(kit.id, (saved) => setPacked(saved, first.id, true))
    expect(await screen.findByText('1 of 2 packed')).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Use as a packing checklist' }))
    await waitFor(() => {
      expect(contents().queryByRole('checkbox')).not.toBeInTheDocument()
    })
    expect((await current(services.repositories.kits.get(kit.id)))?.packedGearIds).toEqual([])
  })

  it('takes an item out of the kit, but not out of your gear', async () => {
    const { user, services } = await renderKit('both')
    await user.click(contents().getByRole('button', { name: 'Remove Fujifilm X-T5' }))
    await waitFor(() => {
      expect(contents().queryByRole('link', { name: 'Fujifilm X-T5' })).not.toBeInTheDocument()
    })
    expect(await current(services.repositories.gear.list())).toHaveLength(4)
  })

  it('renames the kit', async () => {
    const { user } = await renderKit('nothing')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const form = within(await screen.findByRole('dialog', { name: 'Edit Travel light' }))
    const name = form.getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'Travel lighter')
    await user.click(form.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Travel lighter' })).toBeVisible()
  })

  it('deletes the kit after confirming, keeping its gear', async () => {
    const { user, services } = await renderKit('both')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const confirm = within(await screen.findByRole('alertdialog', { name: 'Delete Travel light?' }))
    await user.click(confirm.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Kits' })).toBeInTheDocument()
    expect(await current(services.repositories.kits.list())).toEqual([])
    expect(await current(services.repositories.gear.list())).toHaveLength(4)
  })

  it('says when the kit is not there', async () => {
    renderApp('/kits/6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90')
    expect(await screen.findByRole('heading', { level: 1, name: 'Kit not found' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to kits' })).toBeVisible()
  })
})

describe('kits on an item page', () => {
  it('lists the kits an item is in, linking to each', async () => {
    const { items, services } = await renderKit('both')
    const [first] = items
    if (first === undefined) throw new Error('No gear')
    const user = userEvent.setup()
    await user.click(contents().getByRole('link', { name: 'Fujifilm X-T5' }))
    await screen.findByRole('heading', { level: 1, name: 'Fujifilm X-T5' })
    const kits = within(await screen.findByRole('region', { name: 'Kits' }))
    expect(kits.getByRole('link', { name: 'Travel light' })).toBeVisible()
    expect(await current(services.repositories.kits.withGear(first.id))).toHaveLength(1)
  })
})
