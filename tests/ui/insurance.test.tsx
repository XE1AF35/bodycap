// The insurance list and the CSV export: the gear you have with what an insurer asks for, totals
// per currency, cover photos shown or left out, printing, how to get there, and downloading every
// item as a spreadsheet from Settings.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDate, toIsoDate } from '@/core/dates'
import type { GearFields } from '@/core/gear'
import type { NewPhoto } from '@/core/photos'
import { renderApp, stubDownloads, stubObjectUrls, testServices } from './support'

afterEach(() => {
  vi.restoreAllMocks()
})

const body: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T5',
  serialNumber: '3AB01234',
  purchaseDate: '2025-11-20',
  purchasePrice: { amountMinor: 299900, currency: 'NZD' },
  insuredValue: { amountMinor: 280000, currency: 'NZD' },
  status: 'owned',
}

const lens: GearFields = {
  category: 'lens',
  brand: 'Fujifilm',
  model: 'XF 33mm F1.4 R LM WR',
  purchasePrice: { amountMinor: 89900, currency: 'AUD' },
  status: 'lent-out',
}

const shrunk = (): NewPhoto => ({
  image: new Blob(['image'], { type: 'image/webp' }),
  thumbnail: new Blob(['thumb'], { type: 'image/webp' }),
  mimeType: 'image/webp',
  width: 1600,
  height: 1067,
})

async function renderList(fill: (services: ReturnType<typeof testServices>) => Promise<void>) {
  stubObjectUrls()
  const services = testServices()
  await fill(services)
  const view = renderApp('/insurance', services)
  await screen.findByRole('heading', { level: 1, name: 'Insurance list' })
  return { ...view, services, user: userEvent.setup() }
}

/** Each row of the list, as the text of its cells */
const rows = () =>
  within(screen.getByRole('table', { name: 'Insurance list' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => Array.from(row.children, (cell) => cell.textContent))

describe('the insurance list', () => {
  it('lists the gear you have with what an insurer asks for, and nothing sold or wished for', async () => {
    await renderList(async ({ repositories }) => {
      await repositories.gear.addAll([
        body,
        lens,
        { ...body, model: 'X-T4', status: 'sold', saleDate: '2026-01-05' },
        { ...lens, model: 'XF 56mm', status: 'wishlist' },
      ])
    })
    await screen.findByRole('table', { name: 'Insurance list' })
    expect(rows()).toEqual([
      [
        'Fujifilm X-T5',
        'Camera body',
        '3AB01234',
        formatDate('2025-11-20'),
        '$2,999.00',
        '$2,800.00',
      ],
      ['Fujifilm XF 33mm F1.4 R LM WR', 'Lens', '', '', 'A$899.00', ''],
    ])
  })

  it('totals what the gear is insured for and what it cost, per currency', async () => {
    await renderList(async ({ repositories }) => {
      await repositories.gear.addAll([body, lens])
    })
    const totals = within(await screen.findByRole('region', { name: 'Totals' }))
    expect(totals.getByText('Insured for').nextElementSibling).toHaveTextContent('$2,800.00')
    expect(totals.getByText('Paid').nextElementSibling).toHaveTextContent('$2,999.00 and A$899.00')
    expect(totals.getByText('1 item has no insured value.')).toBeVisible()
  })

  it('shows cover photos, or leaves them out', async () => {
    const { container, user } = await renderList(async ({ repositories }) => {
      const item = await repositories.gear.add(body)
      await repositories.gear.add(lens)
      await repositories.photos.add(item.id, [shrunk()])
    })
    const show = await screen.findByRole('checkbox', { name: 'Show cover photos' })
    expect(show).toBeChecked()
    await waitFor(() => {
      expect(container.querySelectorAll('table img')).toHaveLength(1)
    })
    await user.click(show)
    expect(container.querySelectorAll('table img')).toHaveLength(0)
    expect(screen.queryByRole('columnheader', { name: 'Photo' })).toBeNull()
  })

  it('offers no photo choice when there are no photos', async () => {
    await renderList(async ({ repositories }) => {
      await repositories.gear.add(body)
    })
    await screen.findByRole('table', { name: 'Insurance list' })
    expect(screen.queryByRole('checkbox', { name: 'Show cover photos' })).toBeNull()
  })

  it("prints through the browser's print dialog, and says when it was made", async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const { user } = await renderList(async ({ repositories }) => {
      await repositories.gear.add(body)
    })
    expect(
      await screen.findByText(`Made with Bodycap on ${formatDate(toIsoDate(new Date()))}.`),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Print' }))
    expect(print).toHaveBeenCalledOnce()
  })

  it('says when there is nothing to list', async () => {
    await renderList(async ({ repositories }) => {
      await repositories.gear.add({ ...lens, status: 'wishlist' })
    })
    expect(await screen.findByText('Nothing to insure yet.')).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('is a link away from the dashboard and settings', async () => {
    const services = testServices()
    await services.repositories.gear.add(body)
    renderApp('/', services)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: 'Insurance list' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Insurance list' })).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    const exports = within(await screen.findByRole('region', { name: 'Spreadsheet and insurance' }))
    expect(exports.getByRole('link', { name: 'Open the insurance list' })).toHaveAttribute(
      'href',
      '/insurance',
    )
  })
})

describe('the CSV export', () => {
  it('downloads every item as a spreadsheet, named for today', async () => {
    const saved = stubDownloads()
    const services = testServices()
    await services.repositories.gear.addAll([lens, body])
    renderApp('/settings', services)
    const user = userEvent.setup()
    const exports = within(await screen.findByRole('region', { name: 'Spreadsheet and insurance' }))
    await user.click(await exports.findByRole('button', { name: 'Download gear as CSV' }))
    const name = `bodycap-gear-${toIsoDate(new Date())}.csv`
    expect(await exports.findByText(`Saved as ${name}.`)).toBeInTheDocument()
    expect(saved.map((file) => file.name)).toEqual([name])
    const [file] = saved
    expect(file?.blob.type).toBe('text/csv;charset=utf-8')
    const bytes = new Uint8Array((await file?.blob.arrayBuffer()) ?? new ArrayBuffer(0))
    // The byte order mark that tells Excel it's UTF-8, which decoding as text takes off
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = new TextDecoder().decode(bytes).split('\r\n')
    expect(lines[0]).toMatch(/^"Category","Brand","Model"/)
    // In name order, as the gear list shows them
    expect(lines.slice(1, 3).map((line) => line.split(',')[2])).toEqual([
      '"X-T5"',
      '"XF 33mm F1.4 R LM WR"',
    ])
  })
})
