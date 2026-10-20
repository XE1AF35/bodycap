// Usage on screen, with a fixed today: the line on an item's page, and the Shoots page's list of
// held gear unused for a year.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GearFields } from '@/core/gear'
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

beforeEach(() => {
  // Only the clock is faked, so storage and rendering run as usual. Local midday on 16 October 2026
  // is that date in whatever time zone the tests run in.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 16, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

/** An item's page, once it's loaded */
async function renderItem(services: ReturnType<typeof testServices>, id: string, name: string) {
  renderApp(`/gear/${id}`, services)
  await screen.findByRole('heading', { level: 1, name })
}

describe("an item's usage", () => {
  it('says how many shoots the item was on and when it was last used', async () => {
    const services = testServices()
    const body = await services.repositories.gear.add(camera)
    const shoots = services.repositories.shoots
    await shoots.add({ date: '2026-09-12', name: 'Coast', gearIds: [body.id] })
    await shoots.add({ date: '2026-03-01', name: 'Birds', gearIds: [body.id] })
    await renderItem(services, body.id, 'Fujifilm X-T5')
    expect(
      await screen.findByText('Used on 2 shoots, most recently on 12 Sept 2026.'),
    ).toBeVisible()
  })

  it('says when the item was on a single shoot', async () => {
    const services = testServices()
    const item = await services.repositories.gear.add(lens)
    await services.repositories.shoots.add({
      date: '2026-03-01',
      name: 'Birds',
      gearIds: [item.id],
    })
    await renderItem(services, item.id, 'Fujifilm XF 33mm F1.4')
    expect(await screen.findByText('Used on 1 shoot, on 1 Mar 2026.')).toBeVisible()
  })

  it("says when the item hasn't been on a logged shoot", async () => {
    const services = testServices()
    const item = await services.repositories.gear.add(lens)
    await renderItem(services, item.id, 'Fujifilm XF 33mm F1.4')
    expect(await screen.findByText("It hasn't been on a logged shoot.")).toBeVisible()
  })

  it('says nothing about usage for an item on the wishlist', async () => {
    const services = testServices()
    const item = await services.repositories.gear.add({ ...lens, status: 'wishlist' })
    await renderItem(services, item.id, 'Fujifilm XF 33mm F1.4')
    expect(screen.queryByText(/logged shoot|Used on/)).toBeNull()
  })
})

describe('the unused list', () => {
  it('lists held gear not on a shoot in the past year, linked to its page', async () => {
    const services = testServices()
    const gear = services.repositories.gear
    const body = await gear.add(camera)
    const old = await gear.add(lens)
    await gear.add({ ...lens, model: 'XF 56mm F1.2' })
    await gear.add({ ...lens, model: 'XF 90mm F2', status: 'sold', saleDate: '2026-01-01' })
    await gear.add({
      category: 'tripod',
      brand: 'Peak Design',
      model: 'Travel Tripod',
      status: 'owned',
    })
    const shoots = services.repositories.shoots
    await shoots.add({ date: '2026-09-12', name: 'Coast', gearIds: [body.id] })
    await shoots.add({ date: '2025-10-15', name: 'Birds', gearIds: [old.id] })
    renderApp('/shoots', services)

    const section = within(await screen.findByRole('region', { name: 'Unused' }))
    expect(section.getByText(/based only on the shoots you've logged/)).toBeVisible()
    const list = within(section.getByRole('list'))
    expect(list.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'Fujifilm XF 56mm F1.2Never on a logged shoot',
      'Fujifilm XF 33mm F1.4Last used 15 Oct 2025',
    ])
    await userEvent.click(list.getByRole('link', { name: 'Fujifilm XF 56mm F1.2' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Fujifilm XF 56mm F1.2' }),
    ).toBeVisible()
  })

  it('says when every body, lens, flash, and drone has been on a shoot in the past year', async () => {
    const services = testServices()
    const body = await services.repositories.gear.add(camera)
    await services.repositories.shoots.add({
      date: '2025-10-16',
      name: 'Coast',
      gearIds: [body.id],
    })
    renderApp('/shoots', services)
    const section = within(await screen.findByRole('region', { name: 'Unused' }))
    expect(
      section.getByText(
        'Every camera body, lens, flash, and drone you hold has been on a shoot in the past year.',
      ),
    ).toBeVisible()
    expect(section.queryByRole('list')).toBeNull()
  })

  it('waits until a shoot is logged', async () => {
    const services = testServices()
    await services.repositories.gear.add(camera)
    renderApp('/shoots', services)
    await screen.findByText('No shoots yet.')
    expect(screen.queryByRole('region', { name: 'Unused' })).toBeNull()
  })
})
