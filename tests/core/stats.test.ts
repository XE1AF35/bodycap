// Dashboard stats from the gear already kept: bodies and lenses by mount, how old gear is, the
// warranties still running, and how much gear is in kits. Only gear you have counts.
import { describe, expect, it } from 'vitest'
import type { Gear, GearFields } from '@/core/gear'
import type { Kit } from '@/core/kits'
import { gearAge, gearInKits, mountShare, warrantyTimeline } from '@/core/stats'

const TODAY = '2026-10-08'
const STAMP = '2026-03-01T01:00:00.000Z'
let made = 0

function item(fields: Partial<GearFields> & Pick<GearFields, 'category'>): Gear {
  made += 1
  return {
    brand: 'Brand',
    model: `Model ${String(made)}`,
    status: 'owned',
    ...fields,
    id: `00000000-0000-4000-8000-${String(made).padStart(12, '0')}`,
    createdAt: STAMP,
    updatedAt: STAMP,
  }
}

function kit(name: string, gear: readonly Gear[]): Kit {
  made += 1
  return {
    id: `00000000-0000-4000-8000-${String(made).padStart(12, '0')}`,
    createdAt: STAMP,
    updatedAt: STAMP,
    name,
    gearIds: gear.map(({ id }) => id),
    checklist: false,
    packedGearIds: [],
  }
}

describe('mountShare', () => {
  it('counts bodies and lenses you have by mount, most first, with no mount counted apart', () => {
    const share = mountShare([
      item({ category: 'camera-body', mount: 'sony-e' }),
      item({ category: 'lens', mount: 'sony-e' }),
      item({ category: 'lens', mount: 'sony-e', status: 'lent-out' }),
      item({ category: 'lens', mount: 'nikon-f' }),
      item({ category: 'lens', mount: 'canon-ef' }),
      item({ category: 'lens' }),
      // None of these count: an adapter has two mounts, a bag none, and the rest aren't had
      item({ category: 'mount-adapter', adapterFrom: 'nikon-f', adapterTo: 'sony-e' }),
      item({ category: 'bag' }),
      item({ category: 'lens', mount: 'nikon-f', status: 'sold' }),
      item({ category: 'camera-body', mount: 'nikon-z', status: 'wishlist' }),
    ])
    expect(share).toEqual({
      // A tie goes by the mount's name: Canon EF before Nikon F
      mounts: [
        { mount: 'sony-e', count: 3 },
        { mount: 'canon-ef', count: 1 },
        { mount: 'nikon-f', count: 1 },
      ],
      unrecorded: 1,
      total: 6,
    })
  })

  it('has nothing to count without bodies or lenses', () => {
    expect(mountShare([item({ category: 'bag' })])).toEqual({ mounts: [], unrecorded: 0, total: 0 })
  })
})

describe('gearAge', () => {
  it.each<[string, string, string]>([
    ['a day old', '2026-10-07', 'under-1'],
    ['a day short of a year', '2025-10-09', 'under-1'],
    ['a year to the day', '2025-10-08', '1-2'],
    ['nearly three years', '2023-10-09', '1-2'],
    ['three years', '2023-10-08', '3-5'],
    ['five and a half years', '2021-04-01', '3-5'],
    ['six years', '2020-10-08', '6-10'],
    ['ten years and a bit', '2016-01-01', '6-10'],
    ['eleven years', '2015-10-08', 'over-10'],
    ['bought on a leap day, eight years on', '2016-02-29', '6-10'],
  ])('puts gear %s in its band', (_name, purchaseDate, band) => {
    const { bands } = gearAge([item({ category: 'lens', purchaseDate })], TODAY)
    expect(bands.filter(({ count }) => count > 0)).toEqual([{ band, count: 1 }])
  })

  it('lists every band in order, and counts gear with no purchase date apart', () => {
    const age = gearAge(
      [
        item({ category: 'lens', purchaseDate: '2026-01-01' }),
        item({ category: 'bag', purchaseDate: '2026-06-01', status: 'in-repair' }),
        item({ category: 'tripod' }),
        item({ category: 'lens', purchaseDate: '2010-01-01', status: 'sold' }),
      ],
      TODAY,
    )
    expect(age).toEqual({
      bands: [
        { band: 'under-1', count: 2 },
        { band: '1-2', count: 0 },
        { band: '3-5', count: 0 },
        { band: '6-10', count: 0 },
        { band: 'over-10', count: 0 },
      ],
      unrecorded: 1,
    })
  })
})

describe('warrantyTimeline', () => {
  it('lists the warranties still running, soonest first, and counts those that have ended', () => {
    const later = item({ category: 'camera-body', warrantyExpiry: '2028-03-01' })
    const soon = item({ category: 'lens', warrantyExpiry: '2026-11-01', status: 'lent-out' })
    const endsToday = item({ category: 'flash', warrantyExpiry: TODAY })
    const timeline = warrantyTimeline(
      [
        later,
        item({ category: 'lens', warrantyExpiry: '2026-10-07' }),
        soon,
        item({ category: 'lens' }),
        endsToday,
        item({ category: 'lens', warrantyExpiry: '2027-01-01', status: 'sold' }),
        item({ category: 'lens', warrantyExpiry: '2020-01-01' }),
      ],
      TODAY,
    )
    expect(timeline).toEqual({
      running: [
        { item: endsToday, warrantyExpiry: TODAY, daysLeft: 0 },
        { item: soon, warrantyExpiry: '2026-11-01', daysLeft: 24 },
        { item: later, warrantyExpiry: '2028-03-01', daysLeft: 510 },
      ],
      ended: 2,
    })
  })
})

describe('gearInKits', () => {
  it('counts the gear you have in each kit, and how much is in any kit at all', () => {
    const body = item({ category: 'camera-body' })
    const lens = item({ category: 'lens' })
    const bag = item({ category: 'bag', status: 'in-repair' })
    const sold = item({ category: 'lens', status: 'sold' })
    const loose = item({ category: 'tripod' })
    const travel = kit('Travel', [body, lens, sold])
    const studio = kit('Studio', [body, bag])
    const empty = kit('Astro', [])
    expect(gearInKits([travel, studio, empty], [body, lens, bag, sold, loose])).toEqual({
      kits: [
        { kit: empty, count: 0 },
        { kit: studio, count: 2 },
        { kit: travel, count: 2 },
      ],
      // The body is in two kits, but it's one item
      inKits: 3,
      total: 4,
    })
  })
})
