// Filling the gear form from a picked catalogue entry: the entry's facts go in, and everything
// personal is left as it was. The item stays linked to the entry while its brand, model, and mount
// still say it is that entry.
import { describe, expect, it } from 'vitest'
import { fillFromCatalogue, keepCatalogueLink } from '@/core/catalogue/fill'
import type { CatalogueEntry } from '@/core/catalogue/schema'
import { emptyGearInput, validateGear, type GearInput } from '@/core/gear'
import {
  A7_IV,
  ART_35_L_MOUNT,
  ART_35_SONY_E,
  CATALOGUE,
  FE_28_70,
  FE_50_F18,
  FE_50_F18_UNMEASURED,
} from './support'

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
      weight: '658',
      catalogueId: 'sony-a7-iv',
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
      filterThread: '49',
      weight: '186',
      catalogueId: 'sony-fe-50mm-f1-8',
    })
  })

  it('leaves the weight and filter thread as they are when the catalogue has none', () => {
    const before = { ...typed, weight: '200', filterThread: '52' }
    expect(fillFromCatalogue(before, FE_50_F18_UNMEASURED)).toMatchObject({
      weight: '200',
      filterThread: '52',
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

  it('fills in the mount of the version picked, for a lens made for several mounts', () => {
    expect(fillFromCatalogue(typed, ART_35_L_MOUNT)).toMatchObject({
      mount: 'l-mount',
      catalogueId: ART_35_L_MOUNT.id,
    })
    expect(fillFromCatalogue(typed, ART_35_SONY_E)).toMatchObject({
      mount: 'sony-e',
      catalogueId: ART_35_SONY_E.id,
    })
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
    expect(result).toMatchObject({ ok: true, value: { ...facts, catalogueId: entry.id } })
  })
})

describe('keepCatalogueLink', () => {
  const picked = fillFromCatalogue(typed, A7_IV)
  const linked = { brand: 'Sony', model: 'a7 IV', mount: 'sony-e' }

  it('keeps the link while the brand and model still name the picked model', () => {
    expect(keepCatalogueLink(picked, linked).catalogueId).toBe('sony-a7-iv')
  })

  it('ignores case and spacing, so tidying the name keeps the link', () => {
    const tidied = { ...picked, brand: ' SONY', model: 'A7  iv ' }
    expect(keepCatalogueLink(tidied, linked).catalogueId).toBe('sony-a7-iv')
  })

  it('drops the link once the name says another model', () => {
    expect(keepCatalogueLink({ ...picked, model: 'a7R IV' }, linked).catalogueId).toBe('')
    expect(keepCatalogueLink({ ...picked, brand: 'Sigma' }, linked).catalogueId).toBe('')
  })

  it('keeps it through changes to the optics, weight, or anything personal', () => {
    const edited = { ...picked, weight: '700', notes: 'With grip' }
    expect(keepCatalogueLink(edited, linked)).toEqual(edited)
    const lens = fillFromCatalogue(typed, FE_28_70)
    const zoomed = { ...lens, focalLengthMax: '75', maxApertureTele: '6.3' }
    expect(keepCatalogueLink(zoomed, FE_28_70)).toEqual(zoomed)
  })

  it('drops the link once the mount is not the one picked, as that is another version', () => {
    expect(keepCatalogueLink({ ...picked, mount: 'l-mount' }, linked).catalogueId).toBe('')
    expect(keepCatalogueLink({ ...picked, mount: '' }, linked).catalogueId).toBe('')
    const lens = fillFromCatalogue(typed, ART_35_SONY_E)
    expect(keepCatalogueLink({ ...lens, mount: 'l-mount' }, ART_35_SONY_E).catalogueId).toBe('')
  })

  it('keeps the link while the mount is still the one picked', () => {
    const lens = fillFromCatalogue(typed, ART_35_L_MOUNT)
    expect(keepCatalogueLink(lens, ART_35_L_MOUNT).catalogueId).toBe(ART_35_L_MOUNT.id)
  })

  it('drops an ID with nothing linked to compare it with', () => {
    expect(keepCatalogueLink(picked, undefined).catalogueId).toBe('')
  })
})
