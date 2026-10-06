// The gear detail page: every recorded detail, grouped, and deleting only after confirming.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { formatDate, toIsoDate } from '@/core/dates'
import type { GearFields } from '@/core/gear'
import type { Live } from '@/data/repositories'
import { renderApp, testServices } from './support'

const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  nickname: 'Workhorse',
  serialNumber: '1834567',
  mount: 'sony-e',
  lensCoverage: 'full-frame',
  purchaseDate: '2026-03-01',
  purchasePrice: { amountMinor: 389900, currency: 'NZD' },
  whereBought: 'Photo Warehouse',
  condition: 'excellent',
  status: 'owned',
  currentLocation: 'Studio shelf',
  warrantyExpiry: '2028-03-01',
  insuredValue: { amountMinor: 250000, currency: 'USD' },
  notes: 'Bought with the hood\nand a spare cap',
}

/** The detail page for an item saved just before rendering */
async function renderDetail(fields: GearFields) {
  const services = testServices()
  const item = await services.repositories.gear.add(fields)
  const view = renderApp(`/gear/${item.id}`, services)
  await screen.findByRole('heading', { level: 1, name: `${fields.brand} ${fields.model}` })
  return { ...view, item }
}

/** What the page shows next to a label */
function detail(label: string): string | null | undefined {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent
}

const localDate = (timestamp: string) => formatDate(toIsoDate(new Date(timestamp)))

describe('gear detail', () => {
  it('shows every detail of an item, in groups', async () => {
    const { item } = await renderDetail(lens)
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      'Basics',
      'Purchase',
      'Status and location',
      'Warranty and insurance',
      'Notes',
      'Record',
    ])
    const shown: [string, string][] = [
      ['Category', 'Lens'],
      ['Brand', 'Sony'],
      ['Model', 'FE 24-70mm F2.8 GM II'],
      ['Nickname', 'Workhorse'],
      ['Serial number', '1834567'],
      ['Mount', 'Sony E (including FE)'],
      ['Lens coverage', 'Full frame'],
      ['Purchase date', '1 Mar 2026'],
      ['Purchase price', '$3,899.00'],
      ['Where bought', 'Photo Warehouse'],
      ['Condition', 'Excellent'],
      ['Status', 'Owned'],
      ['Location', 'Studio shelf'],
      ['Warranty ends', '1 Mar 2028'],
      ['Insured value', 'US$2,500.00'],
      ['Added', localDate(item.createdAt)],
      ['Last changed', localDate(item.updatedAt)],
    ]
    for (const [label, value] of shown) expect(detail(label), label).toBe(value)
    expect(screen.getByText(/Bought with the hood/)).toHaveTextContent(
      'Bought with the hood and a spare cap',
    )
  })

  it.each<[string, GearFields, [string, string][]]>([
    [
      'the sale of a sold item',
      {
        category: 'camera-body',
        brand: 'Fujifilm',
        model: 'X-T4',
        sensorFormat: 'aps-c',
        status: 'sold',
        saleDate: '2026-09-20',
        salePrice: { amountMinor: 120000, currency: 'AUD' },
      },
      [
        ['Sensor format', 'APS-C'],
        ['Status', 'Sold'],
        ['Sale date', '20 Sept 2026'],
        ['Sale price', 'A$1,200.00'],
      ],
    ],
    [
      "an adapter's mounts",
      {
        category: 'mount-adapter',
        brand: 'Nikon',
        model: 'FTZ II',
        adapterFrom: 'nikon-f',
        adapterTo: 'nikon-z',
        adapterAutofocus: true,
        status: 'owned',
      },
      [
        ['Lens side', 'Nikon F'],
        ['Camera side', 'Nikon Z'],
        ['Autofocus', 'Yes'],
      ],
    ],
    [
      'the date a lost item went missing',
      { category: 'flash', brand: 'Godox', model: 'V1', status: 'lost', lostDate: '2026-08-02' },
      [
        ['Status', 'Lost'],
        ['Date lost', '2 Aug 2026'],
      ],
    ],
  ])('shows %s', async (_name, fields, shown) => {
    await renderDetail(fields)
    for (const [label, value] of shown) expect(detail(label), label).toBe(value)
  })

  it('leaves out details that were never filled in', async () => {
    await renderDetail({
      category: 'bag',
      brand: 'Peak Design',
      model: 'Sling 6L',
      status: 'owned',
    })
    expect(screen.queryByText('Serial number')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Purchase' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Notes' })).not.toBeInTheDocument()
  })

  it('deletes the item only after confirming, then shows the list', async () => {
    const user = userEvent.setup()
    const { services } = await renderDetail(lens)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete Sony FE 24-70mm F2.8 GM II?',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Gear' })).toBeInTheDocument()
    expect(await screen.findByText("You haven't added any gear yet.")).toBeInTheDocument()
    expect(await current(services.repositories.gear.list())).toEqual([])
  })

  it('keeps the item when the person changes their mind', async () => {
    const user = userEvent.setup()
    const { services, item } = await renderDetail(lens)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sony FE 24-70mm')
    expect(await current(services.repositories.gear.list())).toEqual([item])
  })

  it('says when the item is not there, perhaps deleted in another tab', async () => {
    renderApp('/gear/6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Item not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to your gear' })).toBeInTheDocument()
  })
})

/** The first value a live query gives */
function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}
