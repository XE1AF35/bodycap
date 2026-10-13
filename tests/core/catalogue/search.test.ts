// Searching the catalogue as someone types a model name: partial words, run-together names, focal
// lengths and apertures, the category filter, and the order suggestions come in.
import { describe, expect, it } from 'vitest'
import type { CatalogueEntry } from '@/core/catalogue/schema'
import { createCatalogueSearch } from '@/core/catalogue/search'
import { A7_IV, FE_28_70, FE_50_F18 } from './support'

const EOS_5D_IV = {
  id: 'canon-eos-5d-mark-iv',
  brand: 'Canon',
  model: 'EOS 5D Mark IV',
  category: 'camera-body',
  mount: 'canon-ef',
  sensorFormat: 'full-frame',
} as const satisfies CatalogueEntry

const FE_24_70_GM = {
  id: 'sony-fe-24-70mm-f2-8-gm-ii',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  category: 'lens',
  mount: 'sony-e',
  lensCoverage: 'full-frame',
  focalLengthMin: 24,
  focalLengthMax: 70,
  maxAperture: 2.8,
} as const satisfies CatalogueEntry

const FE_500 = {
  id: 'sony-fe-200-600mm-f5-6-6-3-g-oss',
  brand: 'Sony',
  model: 'FE 200-600mm F5.6-6.3 G OSS',
  category: 'lens',
  mount: 'sony-e',
  lensCoverage: 'full-frame',
  focalLengthMin: 200,
  focalLengthMax: 600,
  maxAperture: 5.6,
  maxApertureTele: 6.3,
} as const satisfies CatalogueEntry

const ids = (result: { entries: readonly CatalogueEntry[] }) => result.entries.map(({ id }) => id)

describe('createCatalogueSearch', () => {
  const search = createCatalogueSearch([A7_IV, FE_50_F18, FE_28_70, EOS_5D_IV, FE_24_70_GM, FE_500])

  it('finds a model by its name', () => {
    expect(search('a7 iv', { category: '' })).toEqual({ entries: [A7_IV], total: 1 })
  })

  it('shows only the chosen category', () => {
    const lenses = search('sony', { category: 'lens' })
    expect(lenses.total).toBe(4)
    expect(lenses.entries.every(({ category }) => category === 'lens')).toBe(true)
    expect(ids(search('sony', { category: 'camera-body' }))).toEqual([A7_IV.id])
  })

  it('suggests nothing for categories the catalogue has no models for', () => {
    expect(search('sony', { category: 'tripod' })).toEqual({ entries: [], total: 0 })
  })

  it.each([
    ['upper case', 'SONY A7 IV'],
    ['accents', 'S\u00f3ny a7 iv'],
    ['the words run together', 'a7iv'],
    ['an alpha sign', '\u03b17 IV'],
    ['part of the last word', 'sony a7 i'],
    ['an alias', 'ILCE-7M4'],
    ['an alias run together', 'ilce7m4'],
    ['the brand and an alias', 'sony ilce 7m4'],
  ])('finds a model typed with %s', (_, text) => {
    expect(ids(search(text, { category: '' }))).toEqual([A7_IV.id])
  })

  it.each([
    ['xt5', 'Fujifilm', 'X-T5'],
    ['em1 iii', 'Olympus', 'OM-D E-M1 Mark III'],
    ['omd em1', 'Olympus', 'OM-D E-M1 Mark III'],
    ['gh5s', 'Panasonic', 'Lumix GH5S'],
  ])('lets %j run words of the name together', (text, brand, model) => {
    const entry = body(brand, model)
    expect(ids(createCatalogueSearch([entry])(text, { category: '' }))).toEqual([entry.id])
  })

  it('only runs together words that sit next to each other in the name', () => {
    // X and T are both in the name, but not side by side
    const apart = body('Fujifilm', 'X-S10 T')
    expect(createCatalogueSearch([apart])('xt', { category: '' }).total).toBe(0)
  })

  it('finds nothing when a run-together word goes on past the end of the name', () => {
    expect(createCatalogueSearch([body('Fujifilm', 'X-T')])('xtz', { category: '' }).total).toBe(0)
  })

  it('puts a run-together match after one that matched a word', () => {
    const exact = body('Fujifilm', 'XT Special')
    const joined = body('Fujifilm', 'X-T')
    const result = createCatalogueSearch([joined, exact])('xt', { category: '' })
    expect(ids(result)).toEqual([exact.id, joined.id])
  })

  it('matches each name on its own, never a mix of the model and an alias', () => {
    // "a7" is in the model and "m4" only in the alias ILCE-7M4
    expect(search('a7m4', { category: '' }).total).toBe(0)
  })

  it.each(['5D Mark IV', '5d mk iv', '5D IV', 'eos 5d mark'])(
    'finds a Mark model typed as %j',
    (text) => {
      expect(ids(search(text, { category: '' }))).toEqual([EOS_5D_IV.id])
    },
  )

  it.each([
    ['the focal length and aperture', '24-70 2.8'],
    ['millimetres and an f-number', '24-70mm f/2.8'],
    ['an f-number with no slash', '24-70 F2.8'],
    ['a capital F run into the number', 'fe 24-70mmF2.8'],
    ['part of the last number', '24-7'],
  ])('finds a lens typed with %s', (_, text) => {
    expect(ids(search(text, { category: 'lens' }))).toEqual([FE_24_70_GM.id])
  })

  it('keeps decimals whole, so 2.8 is not 2 and 8', () => {
    expect(ids(search('8', { category: 'lens' }))).toEqual([])
    expect(ids(search('70 2.8', { category: 'lens' }))).toEqual([FE_24_70_GM.id])
    // Halfway through typing 2.8
    expect(ids(search('24-70 2.', { category: 'lens' }))).toEqual([FE_24_70_GM.id])
  })

  it('matches numbers before the last one exactly', () => {
    // 2 is not a prefix match for 24 once another number follows it
    expect(ids(search('2 70', { category: 'lens' }))).toEqual([])
  })

  it('treats the last number as finished once a space follows it', () => {
    expect(ids(search('20', { category: 'lens' }))).toEqual([FE_500.id])
    expect(ids(search('20 ', { category: 'lens' }))).toEqual([])
    expect(ids(search('50 ', { category: 'lens' }))).toEqual([FE_50_F18.id])
  })

  it('still finds a lens while millimetres or an f-number are half typed', () => {
    expect(ids(search('50m', { category: 'lens' }))).toEqual([FE_50_F18.id])
    expect(ids(search('50mm f', { category: 'lens' }))).toEqual([FE_50_F18.id])
  })
})

// Made-up bodies, so each ranking rule can be shown on its own
function body(brand: string, model: string, aliases?: string[]): CatalogueEntry {
  const id = `${brand}-${model}`.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')
  return {
    id,
    brand,
    model,
    ...(aliases ? { aliases } : {}),
    category: 'camera-body',
    mount: 'sony-e',
    sensorFormat: 'full-frame',
  }
}

describe('the order of suggestions', () => {
  const order = (entries: CatalogueEntry[], text: string) =>
    ids(createCatalogueSearch(entries)(text, { category: '' }))

  it('puts whole-word matches before partly typed ones, even when longer', () => {
    const partly = body('Sony', 'X 200')
    const whole = body('Sony', 'X 20 Long Name')
    expect(order([partly, whole], 'x 20')).toEqual([whole.id, partly.id])
  })

  it('puts a match on the model before a match on an alias', () => {
    const byAlias = body('Sony', 'Q', ['Zeta 1'])
    const byModel = body('Sony', 'Zeta 1')
    expect(order([byAlias, byModel], 'zeta 1')).toEqual([byModel.id, byAlias.id])
  })

  it('puts words in the order typed before words out of order', () => {
    const swapped = body('Sony', 'Beta Alpha')
    const inOrder = body('Sony', 'Alpha Beta Gamma')
    expect(order([swapped, inOrder], 'alpha beta')).toEqual([inOrder.id, swapped.id])
  })

  it('puts a match on the brand first', () => {
    const modelOnly = body('Gamma', 'Delta Epsilon')
    const withBrand = body('Delta', 'Epsilon Long Name')
    expect(order([modelOnly, withBrand], 'delta epsilon')).toEqual([withBrand.id, modelOnly.id])
  })

  it('puts shorter names first, then sorts alphabetically', () => {
    const longer = body('Sony', 'a7R IV')
    const a9 = body('Sony', 'a9 II')
    const a7 = body('Sony', 'a7 IV')
    expect(order([longer, a9, a7], 'sony')).toEqual([a7.id, a9.id, longer.id])
  })

  it('puts a full match before one that skipped a half-typed f or mm at the end', () => {
    const z5 = body('Nikon', 'Z5')
    const zf = body('Nikon', 'Zf', ['Z f'])
    expect(order([z5, zf], 'z f')).toEqual([zf.id, z5.id])
  })

  it('shows the first 10 and counts them all', () => {
    const many = Array.from({ length: 12 }, (_, i) => body('Sony', `Model ${String(i + 1)}`))
    const result = createCatalogueSearch(many)('sony', { category: '' })
    expect(result.entries).toHaveLength(10)
    expect(result.total).toBe(12)
  })

  it.each([
    ['nothing', ''],
    ['spaces', '   '],
    ['one character', 'a'],
    ['one character among spaces', ' a '],
    ['one alpha sign', '\u03b1'],
    ['punctuation only', '--'],
  ])('suggests nothing for %s', (_, text) => {
    expect(createCatalogueSearch([A7_IV])(text, { category: '' })).toEqual({
      entries: [],
      total: 0,
    })
  })

  it('starts suggesting from two characters', () => {
    expect(ids(createCatalogueSearch([A7_IV])('a7', { category: '' }))).toEqual([A7_IV.id])
  })
})
