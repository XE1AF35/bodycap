// Filling the gear form from a picked catalogue entry: the entry's facts go in, and everything
// personal is left as it was.
import { describe, expect, it } from 'vitest'
import { fillFromCatalogue } from '@/core/catalogue/fill'
import type { CatalogueEntry } from '@/core/catalogue/schema'
import { emptyGearInput, validateGear, type GearInput } from '@/core/gear'
import { A7_IV, CATALOGUE, FE_28_70, FE_50_F18 } from './support'

const TODAY = '2026-10-13'

// Everything someone types about their own copy, which a pick must never touch
const PERSONAL = {
  nickname: 'Old faithful',
  serialNumber: '1234567',
  purchaseDate: '2024-03-01',
  purchasePrice: { amount: '3999', currency: 'NZD' },
  whereBought: 'Camera shop',
  condition: 'good',
  status: 'owned',
  currentLocation: 'Studio',
  warrantyExpiry: '2026-03-01',
  insuredValue: { amount: '3500', currency: 'NZD' },
  notes: 'Bought for the wedding season',
} as const satisfies Partial<GearInput>

const typed: GearInput = { ...emptyGearInput('NZD'), ...PERSONAL }

describe('fillFromCatalogue', () => {
  it('fills a camera body', () => {
    expect(fillFromCatalogue(typed, A7_IV)).toEqual({
      ...typed,
      category: 'camera-body',
      brand: 'Sony',
      model: 'a7 IV',
      mount: 'sony-e',
      sensorFormat: 'full-frame',
    })
  })

  it('fills a prime lens', () => {
    expect(fillFromCatalogue(typed, FE_50_F18)).toEqual({
      ...typed,
      category: 'lens',
      brand: 'Sony',
      model: 'FE 50mm F1.8',
      mount: 'sony-e',
      lensCoverage: 'full-frame',
      focalLengthMin: '50',
      focalLengthMax: '50',
      maxAperture: '1.8',
      maxApertureTele: '',
    })
  })

  it('fills a zoom that opens less wide at the long end', () => {
    expect(fillFromCatalogue(typed, FE_28_70)).toMatchObject({
      focalLengthMin: '28',
      focalLengthMax: '70',
      maxAperture: '3.5',
      maxApertureTele: '5.6',
    })
  })

  it('replaces what was typed or picked before, including a long-end aperture', () => {
    const zoom = fillFromCatalogue(typed, FE_28_70)
    const prime = fillFromCatalogue({ ...zoom, brand: 'Sigma', mount: 'l-mount' }, FE_50_F18)
    expect(prime).toMatchObject({ brand: 'Sony', mount: 'sony-e', maxApertureTele: '' })
  })

  it('leaves every personal field as it was', () => {
    for (const entry of CATALOGUE.entries) {
      expect(fillFromCatalogue(typed, entry)).toMatchObject(PERSONAL)
    }
  })

  it.each<[string, CatalogueEntry]>([
    ['a body', A7_IV],
    ['a prime', FE_50_F18],
    ['a zoom', FE_28_70],
  ])('fills %s with values the form saves exactly as they are', (_, entry) => {
    // Everything but the catalogue's own ID and search names
    const facts = Object.fromEntries(
      Object.entries(entry).filter(([key]) => key !== 'id' && key !== 'aliases'),
    )
    const result = validateGear(fillFromCatalogue(typed, entry), TODAY)
    expect(result).toMatchObject({ ok: true, value: facts })
  })
})
