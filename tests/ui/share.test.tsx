// Sharing a kit: the share dialog and its warning, what the link holds as the choices change, and
// copying it. Then opening a shared link, read only, and adding its gear to the wishlist.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { toIsoDate } from '@/core/dates'
import type { Gear, GearFields } from '@/core/gear'
import { addToKit, type Kit } from '@/core/kits'
import { openSharedKit, shareKitLink } from '@/core/share'
import type { Live } from '@/data/repositories'
import { renderApp, testServices } from './support'

const camera: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T5',
  serialNumber: '1AB2345',
  mount: 'fujifilm-x',
  sensorFormat: 'aps-c',
  purchasePrice: { amountMinor: 299900, currency: 'NZD' },
  status: 'owned',
  notes: 'Spare battery in the bag',
}

const lens: GearFields = {
  category: 'lens',
  brand: 'Fujifilm',
  model: 'XF 33mm F1.4 R LM WR',
  mount: 'fujifilm-x',
  lensCoverage: 'aps-c',
  focalLengthMin: 33,
  focalLengthMax: 33,
  maxAperture: 1.4,
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

/** A kit's page, with the kit holding the gear given */
async function renderKit(holding: readonly GearFields[] = [camera, lens]) {
  const services = testServices()
  const items: Gear[] = []
  for (const fields of holding) items.push(await services.repositories.gear.add(fields))
  const kit = await services.repositories.kits.add({ name: 'Street kit', description: 'For walks' })
  await services.repositories.kits.update(kit.id, (saved) =>
    addToKit(
      saved,
      items.map(({ id }) => id),
    ),
  )
  renderApp(`/kits/${kit.id}`, services)
  await screen.findByRole('heading', { level: 1, name: 'Street kit' })
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Share' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Share Street kit' }))
  return { dialog, user }
}

/** The kit in the dialog's link, opened as the person it's sent to would */
function sharedIn() {
  const link = screen.getByRole<HTMLInputElement>('textbox', { name: 'Link' }).value
  const [, part = ''] = link.split('#/shared/')
  const opened = openSharedKit(part, toIsoDate(new Date()))
  if (!opened.ok) throw new Error(opened.error)
  return opened.value
}

describe('sharing a kit', () => {
  it('makes a link, saying where links can end up, with prices and notes only when chosen', async () => {
    const { dialog, user } = await renderKit()
    expect(dialog.getByText(/Links can end up in chat apps/)).toBeVisible()
    expect(dialog.getByText(/Serial numbers and other private details are never/)).toBeVisible()
    expect(dialog.getByRole<HTMLInputElement>('textbox', { name: 'Link' }).value).toMatch(
      /^http.*#\/shared\/[\w-]+$/,
    )
    expect(sharedIn()).toEqual({
      name: 'Street kit',
      items: [
        {
          category: 'camera-body',
          brand: 'Fujifilm',
          model: 'X-T5',
          mount: 'fujifilm-x',
          sensorFormat: 'aps-c',
          status: 'wishlist',
        },
        { ...lens, status: 'wishlist' },
      ],
    })

    await user.click(dialog.getByRole('checkbox', { name: 'Include prices' }))
    expect(sharedIn().items[0]).toHaveProperty('purchasePrice', camera.purchasePrice)
    expect(sharedIn()).not.toHaveProperty('description')

    await user.click(dialog.getByRole('checkbox', { name: /Include notes/ }))
    expect(sharedIn()).toHaveProperty('description', 'For walks')
    expect(sharedIn().items[0]).toHaveProperty('notes', 'Spare battery in the bag')
  })

  it('copies the link', async () => {
    const { dialog, user } = await renderKit()
    await user.click(dialog.getByRole('button', { name: 'Copy link' }))
    expect(await dialog.findByText('Link copied.')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(
      dialog.getByRole<HTMLInputElement>('textbox', { name: 'Link' }).value,
    )
  })

  it('says when there is nothing to share yet', async () => {
    const { dialog } = await renderKit([])
    expect(dialog.getByText("There's nothing in this kit to share yet.")).toBeVisible()
    expect(dialog.queryByRole('textbox', { name: 'Link' })).not.toBeInTheDocument()
    expect(dialog.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument()
  })
})

describe('a shared link', () => {
  const at = '2026-03-01T01:00:00.000Z'
  const theirs: Gear[] = [camera, lens].map((fields, index) => ({
    ...fields,
    id: `00000000-0000-4000-8000-00000000000${String(index + 1)}`,
    createdAt: at,
    updatedAt: at,
  }))
  const theirKit: Kit = {
    id: '00000000-0000-4000-8000-000000000009',
    createdAt: at,
    updatedAt: at,
    name: 'Street kit',
    description: 'For walks',
    gearIds: theirs.map(({ id }) => id),
    checklist: false,
    packedGearIds: [],
  }

  /** The part after #/shared/ of a link made on someone else's device */
  function linkPart() {
    const link = shareKitLink(theirKit, theirs, { prices: true, notes: true })
    if (!link.ok) throw new Error(link.error)
    return link.value
  }

  async function renderShared() {
    const services = testServices()
    // The lens is here already, so it starts unticked
    await services.repositories.gear.add(lens)
    renderApp(`/shared/${linkPart()}`, services)
    await screen.findByRole('heading', { level: 1, name: 'Street kit' })
    const list = within(screen.getByRole('region', { name: 'In this kit' }))
    return { services, list, user: userEvent.setup() }
  }

  it('shows the kit read only, ticking what is not here already', async () => {
    const { list } = await renderShared()
    expect(screen.getByText(/A copy of a kit someone shared with you/)).toBeVisible()
    expect(screen.getByText('For walks')).toBeVisible()
    const cameraBox = list.getByRole('checkbox', { name: 'Fujifilm X-T5' })
    expect(cameraBox).toBeChecked()
    expect(cameraBox).toHaveAccessibleDescription('Price: $2,999.00')
    const lensBox = list.getByRole('checkbox', { name: 'Fujifilm XF 33mm F1.4 R LM WR' })
    expect(lensBox).not.toBeChecked()
    expect(lensBox).toHaveAccessibleDescription('Already in your gear')
    expect(list.getByText('Spare battery in the bag')).toBeVisible()
    expect(list.getByText('33mm f/1.4')).toBeVisible()
  })

  it('adds what is ticked to the wishlist, all at once', async () => {
    const { services, list, user } = await renderShared()
    await user.click(screen.getByRole('button', { name: 'Add to my wishlist' }))
    expect(await screen.findByText('Added 1 item to your wishlist.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See your wishlist' })).toHaveAttribute(
      'href',
      expect.stringContaining('status=wishlist'),
    )
    const gear = await current(services.repositories.gear.list())
    expect(gear).toHaveLength(2)
    const added = gear.find(({ model }) => model === 'X-T5')
    expect(added).toMatchObject({
      status: 'wishlist',
      purchasePrice: camera.purchasePrice,
      notes: 'Spare battery in the bag',
    })
    // The serial never left the other device
    expect(added).not.toHaveProperty('serialNumber')
    // Now on the wishlist, so it isn't offered again
    const cameraBox = list.getByRole('checkbox', { name: 'Fujifilm X-T5' })
    expect(cameraBox).not.toBeChecked()
    expect(cameraBox).toHaveAccessibleDescription('Price: $2,999.00. Already on your wishlist')
    expect(screen.getByRole('button', { name: 'Add to my wishlist' })).toBeDisabled()
  })

  it('adds nothing until something is ticked', async () => {
    const { list, user } = await renderShared()
    await user.click(list.getByRole('checkbox', { name: 'Fujifilm X-T5' }))
    expect(screen.getByRole('button', { name: 'Add to my wishlist' })).toBeDisabled()
  })

  it("explains a link that can't be opened", async () => {
    renderApp('/shared/not-a-kit')
    expect(
      await screen.findByRole('heading', { level: 1, name: "This link can't be opened" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Part of it may have been cut off/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Go to your dashboard' })).toBeInTheDocument()
  })
})
