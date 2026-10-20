// Estimated value on screen, with a fixed today: setting and clearing your own estimate in the gear
// form, the figure on an item's page, and the Money page's totals, marks, and method.
import { screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GearFields } from '@/core/gear'
import { renderApp, testServices } from './support'

const nzd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'NZD' })
const usd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'USD' })

const lens: GearFields = {
  category: 'lens',
  brand: 'Fujifilm',
  model: 'XF 33mm F1.4',
  status: 'owned',
  purchaseDate: '2025-10-16',
  purchasePrice: nzd(1000),
}
const camera: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T5',
  status: 'lent-out',
  purchaseDate: '2024-10-16',
  purchasePrice: nzd(2000),
}

beforeEach(() => {
  // Local midday on 16 October 2026 is that date in whatever time zone the tests run in
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 16, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

const shown = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
const estimateField = () => screen.getByRole('textbox', { name: 'Your own estimate' })
const save = (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Save' }))

async function renderItem(services: ReturnType<typeof testServices>, id: string, name: string) {
  renderApp(`/gear/${id}`, services)
  await screen.findByRole('heading', { level: 1, name })
}

async function renderEdit(services: ReturnType<typeof testServices>, id: string, name: string) {
  renderApp(`/gear/${id}/edit`, services)
  await screen.findByRole('heading', { level: 1, name: `Edit ${name}` })
  return userEvent.setup()
}

/** Each row of a table as its cells' text */
function rowsOf(table: HTMLElement) {
  return within(table)
    .getAllByRole('row')
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent))
}

describe("an item's estimated value", () => {
  it('shows the worked-out figure on the page of an item you have', async () => {
    const services = testServices()
    const item = await services.repositories.gear.add(camera)
    await renderItem(services, item.id, 'Fujifilm X-T5')
    expect(shown('Estimated value')).toBe('$1,548.80Worked out from its price and age')
  })

  it('shows none for gear you no longer have', async () => {
    const services = testServices()
    const item = await services.repositories.gear.add({
      ...lens,
      status: 'sold',
      saleDate: '2026-10-01',
      salePrice: nzd(800),
    })
    await renderItem(services, item.id, 'Fujifilm XF 33mm F1.4')
    expect(screen.queryByText('Estimated value')).toBeNull()
  })

  it('takes your own estimate in the purchase currency, dated today, and clears it', async () => {
    const services = testServices()
    const item = await services.repositories.gear.add({
      ...lens,
      purchasePrice: usd(1000),
    })
    const user = await renderEdit(services, item.id, 'Fujifilm XF 33mm F1.4')
    expect(
      screen.getByText("What you think it's worth now, in USD. Leave it blank to use Bodycap's."),
    ).toBeVisible()
    await user.type(estimateField(), '1,250')
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Fujifilm XF 33mm F1.4' })
    expect(shown('Estimated value')).toBe('US$1,250.00Your own estimate, set 16 Oct 2026')

    await user.click(screen.getByRole('link', { name: 'Edit' }))
    await user.clear(await screen.findByRole('textbox', { name: 'Your own estimate' }))
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Fujifilm XF 33mm F1.4' })
    expect(shown('Estimated value')).toBe('US$920.00Worked out from its price and age')
  })

  it('keeps the date you set it when other details change', async () => {
    const services = testServices()
    const item = await services.repositories.gear.add({
      ...lens,
      ownEstimate: nzd(1100),
      ownEstimateDate: '2026-01-05',
    })
    const user = await renderEdit(services, item.id, 'Fujifilm XF 33mm F1.4')
    expect(estimateField()).toHaveValue('1100.00')
    expect(screen.getByText(/Set on 5 Jan 2026\.$/)).toBeVisible()
    await user.type(screen.getByRole('textbox', { name: 'Nickname' }), 'Walkabout')
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Fujifilm XF 33mm F1.4' })
    expect(shown('Estimated value')).toBe('$1,100.00Your own estimate, set 5 Jan 2026')
  })

  it('is not asked for on the wishlist', async () => {
    const services = testServices()
    const item = await services.repositories.gear.add({ ...lens, status: 'wishlist' })
    await renderEdit(services, item.id, 'Fujifilm XF 33mm F1.4')
    expect(screen.queryByRole('textbox', { name: 'Your own estimate' })).toBeNull()
  })
})

describe("the Money page's estimated value", () => {
  it('totals each currency, marks own estimates, and counts what it leaves out', async () => {
    const services = testServices()
    const { gear } = services.repositories
    await gear.add(lens)
    await gear.add(camera)
    await gear.add({
      category: 'bag',
      brand: 'Peak Design',
      model: 'Everyday Sling',
      status: 'owned',
      ownEstimate: usd(60),
      ownEstimateDate: '2026-09-01',
    })
    const { brand, category, status } = lens
    await gear.add({ brand, category, status, model: 'XF 23mm F2', purchasePrice: nzd(500) })
    await gear.add({ brand, category, status, model: 'XF 50mm F2', purchaseDate: '2025-01-01' })
    await gear.add({ ...lens, model: 'XF 16mm F2.8', status: 'wishlist' })
    renderApp('/money', services)
    await screen.findByRole('heading', { level: 1, name: 'Money' })

    expect(rowsOf(await screen.findByRole('table', { name: 'Estimated value in NZD' }))).toEqual([
      ['Item', 'Paid', 'Estimated value'],
      ['Fujifilm X-T5', '$2,000.00', '$1,548.80'],
      ['Fujifilm XF 33mm F1.4', '$1,000.00', '$920.00'],
      ['Total', '', '$2,468.80'],
    ])
    expect(rowsOf(screen.getByRole('table', { name: 'Estimated value in USD' }))).toEqual([
      ['Item', 'Paid', 'Estimated value'],
      ['Peak Design Everyday Sling', '', 'US$60.00Your own, set 1 Sept 2026'],
      ['Total', '', 'US$60.00'],
    ])
    expect(
      screen.getByText("1 item has no purchase price, so the estimate doesn't include it."),
    ).toBeVisible()
    expect(
      screen.getByText("1 item has no purchase date, so the estimate doesn't include it."),
    ).toBeVisible()
  })

  it('explains the method and rates, and that it is not tax advice', async () => {
    renderApp('/money', testServices())
    await screen.findByRole('heading', { level: 1, name: 'Money' })
    expect(await screen.findByText(/not tax advice/)).toBeVisible()
    expect(rowsOf(screen.getByRole('table', { name: 'Yearly rates' }))).toEqual([
      ['Category', 'Lost each year', 'Never below'],
      ['Camera body', '12%', '10% of the price'],
      ['Lens', '8%', '10% of the price'],
      ['Flash, drone', '14%', '10% of the price'],
      ['Tripod, bag, filter, mount adapter, accessory, other', '10%', '10% of the price'],
      ['Memory card, battery', '30%', 'No floor'],
    ])
  })

  it('says when there is nothing to estimate yet', async () => {
    renderApp('/money', testServices())
    await screen.findByRole('heading', { level: 1, name: 'Money' })
    expect(await screen.findByText('Nothing to estimate yet.')).toBeVisible()
  })
})
