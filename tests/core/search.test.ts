// Gear search: every word across the text fields, accents ignored, filters, and stable sorting.
import { describe, expect, it } from 'vitest'
import { filterAndSortGear, type SearchItem } from '@/core/search'

const item = (id: string, fields: Partial<SearchItem> = {}): SearchItem & { id: string } => ({
  id,
  category: 'lens',
  status: 'owned',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...fields,
})

const ids = (items: readonly { id: string }[]) => items.map(({ id }) => id)

describe('filterAndSortGear: text', () => {
  const gear = [
    item('gm', { mount: 'sony-e' }),
    item('g', { model: 'FE 70-200mm F4 G OSS II' }),
    item('nikon', { brand: 'Nikon', model: 'Z 24-70mm f/2.8 S', category: 'lens' }),
    item('notes', {
      brand: 'Peak Design',
      model: 'Everyday Backpack',
      notes: 'Bought at the Caf\u00E9',
    }),
  ]

  it.each([
    ['', ['nikon', 'notes', 'gm', 'g']],
    ['   ', ['nikon', 'notes', 'gm', 'g']],
    ['sony', ['gm', 'g']],
    ['sony gm', ['gm']],
    ['24-70', ['nikon', 'gm']],
    ['SONY   gM', ['gm']],
    ['sony nikon', []],
    ['cafe', ['notes']],
    ['CAF\u00C9', ['notes']],
    ['Cafe\u0301', ['notes']],
    ['\uFF53\uFF4F\uFF4E\uFF59 gm', ['gm']],
  ])('finds %j in %j', (text, found) => {
    expect(ids(filterAndSortGear(gear, { text }))).toEqual(found)
  })

  it.each([
    ['nickname', { nickname: 'Wedding workhorse' }, 'workhorse'],
    ['serial number', { serialNumber: 'AB-1234567' }, 'ab-1234'],
    ['notes', { notes: 'Small scratch\non the hood' }, 'hood'],
    ['location', { currentLocation: 'Studio shelf' }, 'shelf'],
    ['where it was bought', { whereBought: 'Wellington Camera Store' }, 'wellington'],
  ] as const)('searches the %s', (_field, fields, text) => {
    const gear = [item('match', fields), item('other')]
    expect(ids(filterAndSortGear(gear, { text }))).toEqual(['match'])
  })

  it.each(['0123-4567', '0123 4567', '01234567', '234-56'])(
    'finds a serial however it is typed: %j',
    (text) => {
      const gear = [item('match', { serialNumber: '0123 4567' }), item('other')]
      expect(ids(filterAndSortGear(gear, { text }))).toEqual(['match'])
    },
  )

  it('does not match every serial on a word that is only a hyphen', () => {
    const gear = [item('a', { model: 'a7 IV', serialNumber: '123' })]
    expect(filterAndSortGear(gear, { text: '-' })).toEqual([])
  })

  it('does not let a word run across two fields', () => {
    const gear = [item('a', { brand: 'Sig', model: 'ma 35mm' })]
    expect(filterAndSortGear(gear, { text: 'sigma' })).toEqual([])
  })
})

describe('filterAndSortGear: filters', () => {
  const gear = [
    item('e-lens', { mount: 'sony-e' }),
    item('z-body', { category: 'camera-body', brand: 'Nikon', model: 'Z6 III', mount: 'nikon-z' }),
    item('ftz', {
      category: 'mount-adapter',
      brand: 'Nikon',
      model: 'FTZ II',
      adapterFrom: 'nikon-f',
      adapterTo: 'nikon-z',
    }),
    item('sold-lens', { model: 'FE 85mm F1.8', status: 'sold', mount: 'sony-e' }),
    item('bag', { category: 'bag', brand: 'Peak Design', model: 'Everyday Backpack' }),
  ]

  it.each([
    [{ category: 'lens' }, ['e-lens', 'sold-lens']],
    [{ status: 'sold' }, ['sold-lens']],
    [{ mount: 'nikon-z' }, ['ftz', 'z-body']],
    [{ mount: 'nikon-f' }, ['ftz']],
    [{ category: 'lens', status: 'owned' }, ['e-lens']],
    [{ mount: 'sony-e', text: '85' }, ['sold-lens']],
    [{ category: 'drone' }, []],
    [
      { category: undefined, status: undefined, mount: undefined },
      ['ftz', 'z-body', 'bag', 'e-lens', 'sold-lens'],
    ],
  ] as const)('filters by %j', (query, found) => {
    expect(ids(filterAndSortGear(gear, query))).toEqual(found)
  })
})

describe('filterAndSortGear: sorting', () => {
  it('sorts by brand, then model, comparing numbers as numbers', () => {
    const gear = [
      item('r10', { brand: 'Canon', model: 'EOS R10' }),
      item('a7', { brand: 'Sony', model: 'a7 IV' }),
      item('r5', { brand: 'canon', model: 'EOS R5' }),
      item('r6', { brand: 'Canon', model: 'EOS R6 Mark II' }),
    ]
    expect(ids(filterAndSortGear(gear, {}))).toEqual(['r5', 'r6', 'r10', 'a7'])
    expect(ids(filterAndSortGear(gear, { sort: 'name', descending: true }))).toEqual([
      'a7',
      'r10',
      'r6',
      'r5',
    ])
  })

  it('breaks a tie on brand and model with the nickname', () => {
    const gear = [item('second', { nickname: 'Second' }), item('first', { nickname: 'First' })]
    expect(ids(filterAndSortGear(gear, {}))).toEqual(['first', 'second'])
  })

  it('keeps items that sort the same in their original order, in either direction', () => {
    const gear = [item('one'), item('two'), item('three')]
    expect(ids(filterAndSortGear(gear, {}))).toEqual(['one', 'two', 'three'])
    expect(ids(filterAndSortGear(gear, { descending: true }))).toEqual(['one', 'two', 'three'])
  })

  it('sorts by category and status labels, then by name', () => {
    const gear = [
      item('lens-b', { brand: 'B' }),
      item('body', { category: 'camera-body', status: 'wishlist' }),
      item('lens-a', { brand: 'A', status: 'lent-out' }),
      item('bag', { category: 'bag', status: 'in-repair' }),
    ]
    expect(ids(filterAndSortGear(gear, { sort: 'category' }))).toEqual([
      'bag',
      'body',
      'lens-a',
      'lens-b',
    ])
    expect(ids(filterAndSortGear(gear, { sort: 'status' }))).toEqual([
      'bag',
      'lens-a',
      'lens-b',
      'body',
    ])
  })

  it('sorts by purchase date with undated items last, whichever the direction', () => {
    const gear = [
      item('undated-b', { brand: 'B' }),
      item('2024', { purchaseDate: '2024-05-01' }),
      item('undated-a', { brand: 'A' }),
      item('2022', { purchaseDate: '2022-11-20' }),
      item('2026', { purchaseDate: '2026-02-14' }),
    ]
    expect(ids(filterAndSortGear(gear, { sort: 'purchaseDate' }))).toEqual([
      '2022',
      '2024',
      '2026',
      'undated-a',
      'undated-b',
    ])
    expect(ids(filterAndSortGear(gear, { sort: 'purchaseDate', descending: true }))).toEqual([
      '2026',
      '2024',
      '2022',
      'undated-a',
      'undated-b',
    ])
  })

  it('sorts items bought on the same day by name', () => {
    const gear = [
      item('b', { brand: 'B', purchaseDate: '2025-06-01' }),
      item('a', { brand: 'A', purchaseDate: '2025-06-01' }),
    ]
    expect(ids(filterAndSortGear(gear, { sort: 'purchaseDate', descending: true }))).toEqual([
      'a',
      'b',
    ])
  })

  it('sorts by when each item was last changed', () => {
    const gear = [
      item('older', { updatedAt: '2026-03-01T09:00:00.000Z' }),
      item('newest', { updatedAt: '2026-09-30T21:15:00.000Z' }),
      item('oldest', { updatedAt: '2025-12-24T00:00:00.000Z' }),
    ]
    expect(ids(filterAndSortGear(gear, { sort: 'updatedAt', descending: true }))).toEqual([
      'newest',
      'older',
      'oldest',
    ])
  })

  it('leaves the list it was given untouched', () => {
    const gear = [item('b', { brand: 'B' }), item('a', { brand: 'A' })]
    filterAndSortGear(gear, {})
    expect(ids(gear)).toEqual(['b', 'a'])
  })
})
