// The dashboard: the first-run welcome, counts by status, value totals, alerts, and backing up.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageState } from '@/core/alerts'
import { readBackup } from '@/core/backup/read'
import { addDays, toIsoDate } from '@/core/dates'
import type { GearFields } from '@/core/gear'
import type { StorageHelpers } from '@/data/storage'
import { renderApp, stubDownloads, testServices } from './support'

const nzd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'NZD' })
const usd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'USD' })

const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  purchasePrice: nzd(3899),
  insuredValue: nzd(3500),
  status: 'owned',
}
const body: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T5',
  purchasePrice: nzd(2999),
  status: 'owned',
}
const usLens: GearFields = {
  category: 'lens',
  brand: 'Sigma',
  model: '35mm F1.4 DG DN Art',
  purchasePrice: usd(1599),
  status: 'lent-out',
}
const bag: GearFields = {
  category: 'bag',
  brand: 'Peak Design',
  model: 'Sling 6L',
  status: 'owned',
}
const wanted: GearFields = {
  category: 'drone',
  brand: 'DJI',
  model: 'Mini 4 Pro',
  purchasePrice: nzd(1500),
  status: 'wishlist',
}

const quietStorage: StorageHelpers = {
  requestPersistence: () => Promise.resolve(true),
  storageState: () => Promise.resolve({ usage: 1, quota: 100, persisted: true }),
}

/** The dashboard with these items saved, and storage that raises no alerts unless given */
async function renderDashboard(items: readonly GearFields[], storage = quietStorage) {
  const services = testServices({ storage })
  for (const fields of items) await services.repositories.gear.add(fields)
  const view = renderApp('/', services)
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
  return { ...view, user: userEvent.setup() }
}

const section = (name: string) => screen.getByRole('region', { name })

describe('first run', () => {
  it('welcomes someone with no gear, with ways to start', async () => {
    const user = userEvent.setup()
    renderApp('/')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome to Bodycap' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Restore from a backup' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Add your first item' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Add gear' })).toBeInTheDocument()
  })
})

describe('dashboard', () => {
  it('counts gear by status, each linking to the list filtered by it', async () => {
    const { user, router } = await renderDashboard([lens, body, usLens, bag, wanted])
    const counts = within(section('Your gear'))
    expect(counts.getAllByRole('link').map((link) => link.textContent)).toEqual([
      '3 Owned',
      '1 Wishlist',
      '1 Lent out',
    ])
    await user.click(counts.getByRole('link', { name: '1 Lent out' }))
    await screen.findByRole('heading', { level: 1, name: 'Gear' })
    expect(router.state.location.search).toEqual({ status: 'lent-out' })
  })

  it('adds up what was paid in each currency, with a breakdown by category', async () => {
    await renderDashboard([lens, body, usLens, bag, wanted])
    const value = within(section('Value'))
    expect(value.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '$6,898.00',
      'US$1,599.00',
    ])
    expect(
      value.getByText("1 item has no purchase price, so it isn't counted."),
    ).toBeInTheDocument()
    const rows = within(value.getByRole('table', { name: 'Value by category' })).getAllByRole('row')
    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      'Camera body$2,999.00',
      'Lens$3,899.00, US$1,599.00',
    ])
    expect(value.getByText('Your wishlist adds up to $1,500.00.')).toBeInTheDocument()
  })

  it('switches to insured values', async () => {
    const { user } = await renderDashboard([lens, body, usLens, bag])
    const value = within(section('Value'))
    await user.click(value.getByRole('radio', { name: 'Insured value' }))
    expect(value.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['$3,500.00'])
    expect(
      value.getByText("3 items have no insured value, so they aren't counted."),
    ).toBeInTheDocument()
  })

  it('reminds about a backup that has never been made, and makes one on request', async () => {
    const saved = stubDownloads()

    const { user } = await renderDashboard([lens])
    const attention = within(section('Needs attention'))
    expect(attention.getByText(/You haven't made a backup yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back up now' }))

    const today = toIsoDate(new Date())
    expect(
      await screen.findByText(`Backup saved as bodycap-backup-${today}.json.`),
    ).toBeInTheDocument()
    expect(saved.map(({ name }) => name)).toEqual([`bodycap-backup-${today}.json`])
    const [file] = saved
    expect(readBackup((await file?.blob.text()) ?? '')).toMatchObject({
      ok: true,
      value: { counts: { gear: 1 } },
    })
    await waitFor(() => {
      expect(screen.queryByText(/You haven't made a backup yet/)).not.toBeInTheDocument()
    })
  })

  it('warns about warranties ending soon or just ended, linking to each item', async () => {
    const today = toIsoDate(new Date())
    await renderDashboard([
      { ...lens, purchaseDate: addDays(today, -700), warrantyExpiry: addDays(today, 10) },
      { ...body, purchaseDate: addDays(today, -800), warrantyExpiry: addDays(today, -3) },
    ])
    const attention = within(section('Needs attention'))
    expect(attention.getByText(/ends in 10 days/)).toHaveTextContent(
      'The warranty on Sony FE 24-70mm F2.8 GM II ends in 10 days.',
    )
    expect(attention.getByText(/ended 3 days ago/)).toHaveTextContent(
      'The warranty on Fujifilm X-T5 ended 3 days ago.',
    )
    expect(attention.getByRole('link', { name: 'Fujifilm X-T5' })).toBeInTheDocument()
  })

  it('points out items that share a serial', async () => {
    await renderDashboard([
      { ...lens, serialNumber: '0123-4567' },
      { ...lens, model: 'FE 24-70mm F2.8 GM', serialNumber: '01234567' },
    ])
    const attention = within(section('Needs attention'))
    expect(attention.getByText(/share the serial number 01234567/)).toBeInTheDocument()
    expect(attention.getByRole('link', { name: 'Sony FE 24-70mm F2.8 GM' })).toBeInTheDocument()
  })

  it.each<[string, StorageState, RegExp]>([
    ['nearly full storage', { usage: 92, quota: 100, persisted: true }, /92% full/],
    [
      'storage the browser has not promised to keep yet, gently',
      { usage: 1, quota: 100, persisted: false },
      /hasn't promised to keep Bodycap's data yet\. That's normal/,
    ],
  ])('mentions %s', async (_name, state, message) => {
    const storage: StorageHelpers = { ...quietStorage, storageState: () => Promise.resolve(state) }
    await renderDashboard([lens], storage)
    expect(await within(section('Needs attention')).findByText(message)).toBeInTheDocument()
  })

  it('has nothing that needs attention when everything is in order', async () => {
    const services = testServices({ storage: quietStorage })
    await services.repositories.gear.add(lens)
    await services.repositories.backup.create()
    renderApp('/', services)
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    expect(screen.queryByRole('region', { name: 'Needs attention' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back up now' })).toBeInTheDocument()
  })
})

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})
