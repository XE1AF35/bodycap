// The catalogue's shape: what an entry may say, and the IDs that keep old links working.
import { describe, expect, it } from 'vitest'
import { catalogueSchema } from '@/core/catalogue/schema'
import { A7_IV, CATALOGUE, FE_50_F18, FE_50_F18_UNMEASURED } from './support'

const withEntry = (entry: object) => ({ ...CATALOGUE, entries: [entry] })

describe('catalogueSchema', () => {
  it('accepts bodies, primes, and zooms', () => {
    expect(catalogueSchema.safeParse(CATALOGUE).success).toBe(true)
  })

  it('accepts entries without a weight or filter thread', () => {
    expect(catalogueSchema.safeParse(withEntry(FE_50_F18_UNMEASURED)).success).toBe(true)
  })

  it('accepts an empty catalogue', () => {
    const empty = { ...CATALOGUE, entries: [], retired: [], renamed: {} }
    expect(catalogueSchema.safeParse(empty).success).toBe(true)
  })

  it.each([
    ['upper case', 'Sony-a7-iv'],
    ['an underscore', 'sony_a7_iv'],
    ['a space', 'sony a7 iv'],
    ['a leading hyphen', '-sony-a7-iv'],
    ['a trailing hyphen', 'sony-a7-iv-'],
    ['two hyphens together', 'sony--a7-iv'],
    ['nothing at all', ''],
    ['more than 80 characters', 'a'.repeat(81)],
  ])('refuses an ID with %s', (_, id) => {
    expect(catalogueSchema.safeParse(withEntry({ ...A7_IV, id })).success).toBe(false)
  })

  it.each([
    ['a category other than body or lens', { ...A7_IV, category: 'tripod' }],
    ['an unknown mount', { ...A7_IV, mount: 'minolta-sr' }],
    ['an unknown sensor format', { ...A7_IV, sensorFormat: 'one-inch' }],
    ['a lens field on a body', { ...A7_IV, lensCoverage: 'full-frame' }],
    ['a body field on a lens', { ...FE_50_F18, sensorFormat: 'full-frame' }],
    ['a field nobody knows', { ...A7_IV, releaseYear: 2021 }],
    ['a filter thread on a body', { ...A7_IV, filterThread: 52 }],
    ['a weight in part grams', { ...A7_IV, weight: 658.5 }],
    ['a weight of nothing', { ...A7_IV, weight: 0 }],
    ['a lens with no focal length', { ...FE_50_F18, focalLengthMin: undefined }],
    ['a lens with no aperture', { ...FE_50_F18, maxAperture: undefined }],
    ['a blank brand', { ...A7_IV, brand: '' }],
    ['a blank model', { ...A7_IV, model: '' }],
    ['a brand over 80 characters', { ...A7_IV, brand: 'S'.repeat(81) }],
    ['a model over 120 characters', { ...A7_IV, model: 'a'.repeat(121) }],
    [
      'more than 8 aliases',
      { ...A7_IV, aliases: Array.from({ length: 9 }, (_, i) => `a${String(i)}`) },
    ],
    ['an alias over 120 characters', { ...A7_IV, aliases: ['a'.repeat(121)] }],
  ])('refuses %s', (_, entry) => {
    expect(catalogueSchema.safeParse(withEntry(entry)).success).toBe(false)
  })

  it.each([
    ['another format', { ...CATALOGUE, format: 2 }],
    ['a version that is not a date', { ...CATALOGUE, version: 'v1' }],
    ['a badly formed retired ID', { ...CATALOGUE, retired: ['Old ID'] }],
    ['a badly formed renamed ID', { ...CATALOGUE, renamed: { 'old-id': 'New ID' } }],
    ['an unknown top-level field', { ...CATALOGUE, source: 'lensfun' }],
  ])('refuses a catalogue with %s', (_, catalogue) => {
    expect(catalogueSchema.safeParse(catalogue).success).toBe(false)
  })
})
