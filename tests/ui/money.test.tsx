// The Money page: spend by calendar year, a table and a chart per currency, and totals marked as
// partial when items have no purchase date or price.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { GearFields } from '@/core/gear'
import { renderApp, testServices } from './support'

const nzd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'NZD' })
const usd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'USD' })

const camera: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T5',
  status: 'sold',
  purchaseDate: '2024-03-01',
  purchasePrice: nzd(2800),
  saleDate: '2026-02-01',
  salePrice: nzd(1900),
}
// A lens with no purchase details yet
const prime: GearFields = {
  category: 'lens',
  brand: 'Fujifilm',
  model: 'XF 33mm F1.4',
  status: 'owned',
}
const lens: GearFields = { ...prime, purchaseDate: '2026-05-01', purchasePrice: nzd(1100) }

async function renderMoney(services: ReturnType<typeof testServices>) {
  renderApp('/money', services)
  await screen.findByRole('heading', { level: 1, name: 'Money' })
}

/** Each row of a table as its cells' text */
function rowsOf(table: HTMLElement) {
  return within(table)
    .getAllByRole('row')
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent))
}

describe('the Money page', () => {
  it('opens from the header', async () => {
    const user = userEvent.setup()
    renderApp('/gear')
    await screen.findByRole('heading', { level: 1, name: 'Gear' })
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Dashboard', 'Gear', 'Kits', 'Shoots', 'Money', 'System', 'Settings'])
    await user.click(within(nav).getByRole('link', { name: 'Money' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Money' })).toBeVisible()
  })

  it('says when there is no spend to show yet', async () => {
    await renderMoney(testServices())
    expect(await screen.findByText('Nothing bought yet.')).toBeVisible()
  })

  it('shows bought, maintenance, sold, and net spend for each year, with a chart', async () => {
    const services = testServices()
    const { gear, maintenance } = services.repositories
    const body = await gear.add(camera)
    await gear.add(lens)
    await maintenance.add(body.id, { type: 'repair', date: '2025-06-01', cost: nzd(250) })
    await renderMoney(services)

    const table = await screen.findByRole('table', { name: 'Spend by year in NZD' })
    expect(rowsOf(table)).toEqual([
      ['Year', 'Bought', 'Maintenance', 'Sold', 'Net spend'],
      ['2024', '$2,800.00', '$0.00', '$0.00', '$2,800.00'],
      ['2025', '$0.00', '$250.00', '$0.00', '$250.00'],
      ['2026', '$1,100.00', '$0.00', '$1,900.00', '-$800.00'],
    ])
    expect(screen.getByRole('figure', { name: 'Net spend by year in NZD' })).toBeVisible()
  })

  it('keeps currencies apart and marks the totals as partial', async () => {
    const services = testServices()
    const { gear } = services.repositories
    await gear.add(lens)
    await gear.add({
      ...prime,
      model: 'XF 23mm F2',
      purchaseDate: '2026-01-10',
      purchasePrice: usd(450),
    })
    await gear.add({ ...prime, model: 'XF 50mm F2', purchasePrice: nzd(500) })
    await gear.add({ ...prime, model: 'XF 16mm F2.8', purchaseDate: '2026-02-01' })
    // Not bought yet, so it isn't spend
    await gear.add({
      ...prime,
      model: 'XF 56mm F1.2',
      status: 'wishlist',
      purchasePrice: nzd(1500),
    })
    await renderMoney(services)

    const table = await screen.findByRole('table', { name: 'Spend by year in NZD' })
    expect(rowsOf(table)).toEqual([
      ['Year', 'Bought', 'Maintenance', 'Sold', 'Net spend'],
      ['2026', '$1,100.00', '$0.00', '$0.00', '$1,100.00'],
      ['No purchase date', '$500.00', '', '', '$500.00'],
    ])
    expect(rowsOf(screen.getByRole('table', { name: 'Spend by year in USD' }))).toEqual([
      ['Year', 'Bought', 'Maintenance', 'Sold', 'Net spend'],
      ['2026', 'US$450.00', 'US$0.00', 'US$0.00', 'US$450.00'],
    ])
    expect(
      screen.getByText("1 item has no purchase date, so it's counted apart from the years."),
    ).toBeVisible()
    expect(
      screen.getByText("1 item has no purchase price, so the totals don't include it."),
    ).toBeVisible()
  })
})
