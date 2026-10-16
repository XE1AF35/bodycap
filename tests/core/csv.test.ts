// CSV export: quoting every cell, the byte order mark and line endings, defusing cells a
// spreadsheet would run as formulas, and the columns of the gear file.
import { describe, expect, it } from 'vitest'
import { csvFileName, gearCsv, toCsv } from '@/core/csv'
import type { Gear } from '@/core/gear'

const BOM = '\uFEFF'

/** The rows of a CSV file, with the byte order mark checked and taken off */
const linesOf = (csv: string) => {
  expect(csv.startsWith(BOM)).toBe(true)
  return csv.slice(BOM.length).split('\r\n')
}

describe('toCsv', () => {
  it('starts with a byte order mark, quotes every cell, and ends each row with CRLF', () => {
    expect(
      toCsv([
        ['Brand', 'Model'],
        ['Sony', 'A7 IV'],
      ]),
    ).toBe(`${BOM}"Brand","Model"\r\n"Sony","A7 IV"\r\n`)
  })

  it.each([
    ['an empty cell', '', '""'],
    ['commas', 'Bag, sling', '"Bag, sling"'],
    ['double quotes, doubled', 'The "nifty fifty"', '"The ""nifty fifty"""'],
    ['line breaks, kept inside the quotes', 'Two\nlines', '"Two\nlines"'],
    ['a number', '3899.00', '"3899.00"'],
    ['a minus sign later on', 'EF-S 18-55mm', '"EF-S 18-55mm"'],
  ])('writes %s as text', (_name, cell, written) => {
    expect(toCsv([[cell]])).toBe(`${BOM}${written}\r\n`)
  })

  it.each([
    ['=HYPERLINK("http://example.com")', `"'=HYPERLINK(""http://example.com"")"`],
    ['+64 21 123 4567', `"'+64 21 123 4567"`],
    ['-2+3', `"'-2+3"`],
    ['@SUM(A1)', `"'@SUM(A1)"`],
    ['\tTab first', `"'\tTab first"`],
    ['\rReturn first', `"'\rReturn first"`],
    ['\uFF1D1+1', `"'\uFF1D1+1"`],
    ['\uFF0B1', `"'\uFF0B1"`],
    ['\uFF0D1', `"'\uFF0D1"`],
    ['\uFF20SUM(A1)', `"'\uFF20SUM(A1)"`],
  ])('defuses %j, which a spreadsheet would run, with an apostrophe', (cell, written) => {
    expect(toCsv([[cell]])).toBe(`${BOM}${written}\r\n`)
  })

  it('writes a file with no rows as just the byte order mark', () => {
    expect(toCsv([])).toBe(BOM)
  })
})

const stamps = { createdAt: '2026-03-02T01:00:00.000Z', updatedAt: '2026-06-11T22:45:10.250Z' }

const lens: Gear = {
  id: '6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90',
  ...stamps,
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  nickname: 'Workhorse',
  serialNumber: '1834567',
  mount: 'sony-e',
  lensCoverage: 'full-frame',
  focalLengthMin: 24,
  focalLengthMax: 70,
  maxAperture: 2.8,
  filterThread: 82,
  weight: 695,
  catalogueId: 'sony-fe-24-70mm-f2-8-gm-ii',
  purchaseDate: '2026-03-01',
  purchasePrice: { amountMinor: 389900, currency: 'NZD' },
  whereBought: 'Photo Warehouse',
  condition: 'like-new',
  status: 'owned',
  currentLocation: 'Studio',
  warrantyExpiry: '2028-03-01',
  insuredValue: { amountMinor: 400000, currency: 'NZD' },
  notes: 'Bought with the hood\nand a spare cap',
}

const adapter: Gear = {
  id: 'c3d1e8f2-5a4b-4c7d-8e9f-0a1b2c3d4e5f',
  ...stamps,
  category: 'mount-adapter',
  brand: 'Nikon',
  model: 'FTZ II',
  adapterFrom: 'nikon-f',
  adapterTo: 'nikon-z',
  adapterAutofocus: true,
  purchasePrice: { amountMinor: 45000, currency: 'JPY' },
  status: 'sold',
  saleDate: '2026-09-20',
  salePrice: { amountMinor: 120000, currency: 'AUD' },
}

const HEADER = [
  'Category',
  'Brand',
  'Model',
  'Nickname',
  'Serial number',
  'Status',
  'Condition',
  'Mount',
  'Sensor format',
  'Lens coverage',
  'Adapter lens side',
  'Adapter camera side',
  'Adapter autofocus',
  'Shortest focal length (mm)',
  'Longest focal length (mm)',
  'Widest aperture',
  'Widest aperture at the long end',
  'Filter thread (mm)',
  'Weight (g)',
  'Purchase date',
  'Purchase price',
  'Purchase currency',
  'Where bought',
  'Location',
  'Warranty ends',
  'Insured value',
  'Insured value currency',
  'Sale date',
  'Sale price',
  'Sale currency',
  'Date lost',
  'Notes',
  'Added',
  'Last changed',
  'ID',
  'Catalogue ID',
]

/** One row as written, from its cells */
const row = (cells: readonly string[]) => cells.map((cell) => `"${cell}"`).join(',')

describe('gearCsv', () => {
  it('writes a header row, then one row per item in the order given', () => {
    const lines = linesOf(gearCsv([lens, adapter]))
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe(row(HEADER))
    expect(lines[3]).toBe('')
  })

  it('writes every field in words a person reads, with amounts and currencies apart', () => {
    const lines = linesOf(gearCsv([lens]))
    expect(lines[1]).toBe(
      row([
        'Lens',
        'Sony',
        'FE 24-70mm F2.8 GM II',
        'Workhorse',
        '1834567',
        'Owned',
        'Like new',
        'Sony E (including FE)',
        '',
        'Full frame',
        '',
        '',
        '',
        '24',
        '70',
        '2.8',
        '',
        '82',
        '695',
        '2026-03-01',
        '3899.00',
        'NZD',
        'Photo Warehouse',
        'Studio',
        '2028-03-01',
        '4000.00',
        'NZD',
        '',
        '',
        '',
        '',
        'Bought with the hood\nand a spare cap',
        '2026-03-02T01:00:00.000Z',
        '2026-06-11T22:45:10.250Z',
        lens.id,
        'sony-fe-24-70mm-f2-8-gm-ii',
      ]),
    )
  })

  it("writes an adapter's two sides, and amounts with each currency's own decimals", () => {
    const cells =
      linesOf(gearCsv([adapter]))[1]
        ?.slice(1, -1)
        .split('","') ?? []
    const byHeader = Object.fromEntries(HEADER.map((header, index) => [header, cells[index]]))
    expect(byHeader).toMatchObject({
      'Adapter lens side': 'Nikon F',
      'Adapter camera side': 'Nikon Z',
      'Adapter autofocus': 'Yes',
      'Purchase price': '45000',
      'Purchase currency': 'JPY',
      'Sale price': '1200.00',
      'Sale currency': 'AUD',
      Status: 'Sold',
    })
  })

  it('writes weights as plain whole grams, and leaves blank what an item has none of', () => {
    const cells = linesOf(gearCsv([{ ...adapter, weight: 1370 }]))[1]
      ?.slice(1, -1)
      .split('","')
    expect(cells?.[HEADER.indexOf('Weight (g)')]).toBe('1370')
    expect(cells?.[HEADER.indexOf('Filter thread (mm)')]).toBe('')
    expect(cells?.[HEADER.indexOf('Catalogue ID')]).toBe('')
  })

  it('writes autofocus as No when an adapter has none', () => {
    const cells = linesOf(gearCsv([{ ...adapter, adapterAutofocus: false }]))[1]?.split('","')
    expect(cells?.[HEADER.indexOf('Adapter autofocus')]).toBe('No')
  })

  it('writes just the header when there is no gear', () => {
    expect(linesOf(gearCsv([]))).toEqual([row(HEADER), ''])
  })
})

describe('csvFileName', () => {
  it('names the file after the day it was made', () => {
    expect(csvFileName('2026-10-09')).toBe('bodycap-gear-2026-10-09.csv')
  })
})
