// Dashboard stats: bodies and lenses by mount, how old gear is, warranties still running, gear in
// kits, and value by category. Each is a table, with bars for the eye only, and a stat with nothing
// to show is left out.
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { addDays, formatDate, toIsoDate } from '@/core/dates'
import type { Gear, GearFields } from '@/core/gear'
import { addToKit } from '@/core/kits'
import { renderApp, testServices } from './support'

const today = toIsoDate(new Date())
const daysAgo = (days: number) => addDays(today, -days)

const body: GearFields = {
  category: 'camera-body',
  brand: 'Sony',
  model: 'A7 IV',
  mount: 'sony-e',
  purchaseDate: daysAgo(400),
  purchasePrice: { amountMinor: 400000, currency: 'NZD' },
  warrantyExpiry: addDays(today, 400),
  status: 'owned',
}
const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 35mm F1.8',
  mount: 'sony-e',
  purchaseDate: daysAgo(30),
  purchasePrice: { amountMinor: 100000, currency: 'NZD' },
  warrantyExpiry: addDays(today, 24),
  status: 'owned',
}
const oldLens: GearFields = {
  category: 'lens',
  brand: 'Nikon',
  model: 'AF-S 50mm f/1.8G',
  mount: 'nikon-f',
  purchaseDate: daysAgo(365 * 12),
  warrantyExpiry: daysAgo(10),
  status: 'lent-out',
}
const usLens: GearFields = {
  category: 'lens',
  brand: 'Sigma',
  model: '24mm F1.4 DG DN',
  purchasePrice: { amountMinor: 80000, currency: 'USD' },
  status: 'owned',
}
const bag: GearFields = {
  category: 'bag',
  brand: 'Peak Design',
  model: 'Sling 6L',
  status: 'owned',
}

/** The dashboard, with the gear given saved, and kits holding gear by its place in that list */
async function renderStats(
  gear: readonly GearFields[],
  kits: readonly (readonly [string, readonly number[]])[] = [],
) {
  const services = testServices()
  const saved: Gear[] = []
  for (const fields of gear) saved.push(await services.repositories.gear.add(fields))
  for (const [name, places] of kits) {
    const kit = await services.repositories.kits.add({ name })
    await services.repositories.kits.update(kit.id, (current) =>
      addToKit(
        current,
        places.flatMap((place) => saved[place]?.id ?? []),
      ),
    )
  }
  renderApp('/', services)
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
}

const stats = () => within(screen.getByRole('region', { name: 'Your gear in numbers' }))

/** Each row of a table below its headings, as the text of each cell */
function rowsOf(table: HTMLElement) {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent))
}

describe('dashboard stats', () => {
  it('shows bodies and lenses by mount, with the share of each', async () => {
    await renderStats([body, lens, oldLens, usLens, bag])
    const mounts = within(stats().getByRole('region', { name: 'Mounts' }))
    expect(mounts.getByText('Your main mount is Sony E (including FE).')).toBeVisible()
    expect(rowsOf(mounts.getByRole('table', { name: 'Bodies and lenses by mount' }))).toEqual([
      ['Sony E (including FE)', '2', '50%'],
      ['Nikon F', '1', '25%'],
      ['No mount recorded', '1', '25%'],
    ])
  })

  it('shows how long ago gear was bought', async () => {
    await renderStats([body, lens, oldLens, usLens, bag])
    const age = within(stats().getByRole('region', { name: 'Age' }))
    expect(rowsOf(age.getByRole('table', { name: 'Gear by when it was bought' }))).toEqual([
      ['Under a year', '1'],
      ['1 to 2 years', '1'],
      ['3 to 5 years', '0'],
      ['6 to 10 years', '0'],
      ['Over 10 years', '1'],
    ])
    expect(age.getByText("2 items have no purchase date, so they aren't counted.")).toBeVisible()
  })

  it('lists the warranties still running, soonest first', async () => {
    await renderStats([body, lens, oldLens])
    const warranties = within(stats().getByRole('region', { name: 'Warranties' }))
    expect(
      warranties.getByText(
        '2 warranties are still running, the first ending in 24 days. 1 has ended.',
      ),
    ).toBeVisible()
    expect(rowsOf(warranties.getByRole('table', { name: 'Warranties still running' }))).toEqual([
      ['Sony FE 35mm F1.8', formatDate(addDays(today, 24)), '24 days'],
      ['Sony A7 IV', formatDate(addDays(today, 400)), '13 months'],
    ])
  })

  it('shows how much gear is in each kit', async () => {
    await renderStats(
      [body, lens, oldLens, bag],
      [
        ['Travel', [0, 1]],
        ['Studio', [0, 3]],
        ['Astro', []],
      ],
    )
    const kits = within(stats().getByRole('region', { name: 'Kits' }))
    expect(kits.getByText('3 of the 4 items you have are in a kit.')).toBeVisible()
    expect(rowsOf(kits.getByRole('table', { name: 'Items in each kit' }))).toEqual([
      ['Astro', '0'],
      ['Studio', '2'],
      ['Travel', '2'],
    ])
  })

  it('draws its bars for the eye only, as the tables hold the numbers', async () => {
    await renderStats([body, lens, oldLens], [['Travel', [0]]])
    const bars = screen
      .getByRole('region', { name: 'Your gear in numbers' })
      .querySelectorAll('svg')
    expect(bars.length).toBeGreaterThan(0)
    for (const bar of bars) expect(bar).toHaveAttribute('aria-hidden', 'true')
  })

  it('leaves out stats with nothing to show', async () => {
    await renderStats([bag])
    expect(screen.queryByRole('region', { name: 'Your gear in numbers' })).not.toBeInTheDocument()
  })

  it('compares value by category with bars, saying which currency they compare', async () => {
    await renderStats([body, lens, usLens])
    const value = within(screen.getByRole('region', { name: 'Value' }))
    const table = value.getByRole('table', { name: 'Value by category' })
    expect(table.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2)
    expect(value.getByText('The bars compare amounts in NZD.')).toBeVisible()
  })
})
