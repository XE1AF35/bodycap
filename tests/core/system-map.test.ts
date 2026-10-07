// The system map: each camera's lenses, as they are and through adapters you own, what each
// adapter unlocks, lenses no camera can take and why, and the focal lengths each camera covers.
import { describe, expect, it } from 'vitest'
import type { Gear, GearFields } from '@/core/gear'
import { systemMap, type BodyMap } from '@/core/system-map'

const STAMP = '2026-03-01T01:00:00.000Z'
let made = 0

/** An item you have, unless the fields say otherwise, with an ID of its own */
function item(
  fields: Partial<GearFields> & Pick<GearFields, 'category' | 'brand' | 'model'>,
): Gear {
  made += 1
  return {
    status: 'owned',
    ...fields,
    id: `00000000-0000-4000-8000-${String(made).padStart(12, '0')}`,
    createdAt: STAMP,
    updatedAt: STAMP,
  }
}

const z6 = item({
  category: 'camera-body',
  brand: 'Nikon',
  model: 'Z6 III',
  mount: 'nikon-z',
  sensorFormat: 'full-frame',
})
const z50 = item({
  category: 'camera-body',
  brand: 'Nikon',
  model: 'Z50 II',
  mount: 'nikon-z',
  sensorFormat: 'aps-c',
})
const a7 = item({
  category: 'camera-body',
  brand: 'Sony',
  model: 'A7 IV',
  mount: 'sony-e',
  sensorFormat: 'full-frame',
})
const zoom = item({
  category: 'lens',
  brand: 'Nikon',
  model: 'Z 24-70mm f/4 S',
  mount: 'nikon-z',
  lensCoverage: 'full-frame',
  focalLengthMin: 24,
  focalLengthMax: 70,
  maxAperture: 4,
})
const dx = item({
  category: 'lens',
  brand: 'Nikon',
  model: 'Z DX 16-50mm',
  mount: 'nikon-z',
  lensCoverage: 'aps-c',
  focalLengthMin: 16,
  focalLengthMax: 50,
})
const fifty = item({
  category: 'lens',
  brand: 'Nikon',
  model: 'AF-S 50mm f/1.8G',
  mount: 'nikon-f',
  lensCoverage: 'full-frame',
  focalLengthMin: 50,
  focalLengthMax: 50,
})
const tele = item({
  category: 'lens',
  brand: 'Nikon',
  model: 'Z 180-600mm',
  mount: 'nikon-z',
  lensCoverage: 'full-frame',
  focalLengthMin: 180,
  focalLengthMax: 600,
})
const macro = item({
  category: 'lens',
  brand: 'Canon',
  model: 'EF 100mm Macro',
  mount: 'canon-ef',
  focalLengthMin: 100,
  focalLengthMax: 100,
})
const rf = item({ category: 'lens', brand: 'Canon', model: 'RF 50mm', mount: 'canon-rf' })
const mystery = item({ category: 'lens', brand: 'Old', model: 'Mystery 35mm' })
const ftz = item({
  category: 'mount-adapter',
  brand: 'Nikon',
  model: 'FTZ II',
  adapterFrom: 'nikon-f',
  adapterTo: 'nikon-z',
  adapterAutofocus: true,
})
const m42 = item({
  category: 'mount-adapter',
  brand: 'Fotodiox',
  model: 'M42 to E',
  adapterFrom: 'm42',
  adapterTo: 'sony-e',
})
const half = item({
  category: 'mount-adapter',
  brand: 'Unknown',
  model: 'Adapter',
  adapterFrom: 'm42',
})
const bag = item({ category: 'bag', brand: 'Peak Design', model: 'Sling 6L' })

const EVERYTHING = [tele, a7, dx, rf, z50, ftz, mystery, zoom, m42, z6, half, fifty, macro, bag]

const names = (gear: readonly Gear[]) => gear.map(({ brand, model }) => `${brand} ${model}`)

/** Each lens a camera takes: its name, how it fits, and its focal lengths on that camera */
const lensesOf = (body: BodyMap | undefined) =>
  body?.lenses.map(({ lens, result, range }) => [`${lens.brand} ${lens.model}`, result, range])

describe('systemMap', () => {
  it("lists each camera's lenses, as they are and through adapters you own, by focal length", () => {
    const map = systemMap(EVERYTHING)
    expect(names(map.bodies.map(({ body }) => body))).toEqual([
      'Nikon Z6 III',
      'Nikon Z50 II',
      'Sony A7 IV',
    ])
    const [onZ6, onZ50, onA7] = map.bodies
    expect(lensesOf(onZ6)).toEqual([
      // A DX lens on full frame is cropped, so it frames like a longer lens there
      ['Nikon Z 24-70mm f/4 S', { fit: 'native', crop: false }, { min: 24, max: 70 }],
      ['Nikon Z DX 16-50mm', { fit: 'native', crop: true }, { min: 24, max: 75 }],
      [
        'Nikon AF-S 50mm f/1.8G',
        { fit: 'adapter', adapterId: ftz.id, autofocus: true, crop: false },
        { min: 50, max: 50 },
      ],
      ['Nikon Z 180-600mm', { fit: 'native', crop: false }, { min: 180, max: 600 }],
    ])
    expect(lensesOf(onZ50)?.map(([name, , range]) => [name, range])).toEqual([
      ['Nikon Z DX 16-50mm', { min: 16, max: 50 }],
      // A full-frame lens isn't cropped any further than the sensor already is
      ['Nikon Z 24-70mm f/4 S', { min: 24, max: 70 }],
      ['Nikon AF-S 50mm f/1.8G', { min: 50, max: 50 }],
      ['Nikon Z 180-600mm', { min: 180, max: 600 }],
    ])
    expect(onA7?.lenses).toEqual([])
  })

  it('finds the focal lengths each camera covers, and the gaps between', () => {
    const [onZ6, onZ50, onA7] = systemMap(EVERYTHING).bodies
    expect(onZ6?.covered).toEqual([
      { min: 24, max: 75 },
      { min: 180, max: 600 },
    ])
    expect(onZ6?.gaps).toEqual([{ min: 75, max: 180 }])
    expect(onZ50?.gaps).toEqual([{ min: 70, max: 180 }])
    expect([onA7?.covered, onA7?.gaps]).toEqual([[], []])
  })

  it.each<[string, readonly (readonly [number, number])[], readonly (readonly [number, number])[]]>(
    [
      [
        'the missing middle between a wide zoom and a telephoto',
        [
          [16, 35],
          [70, 200],
        ],
        [[35, 70]],
      ],
      [
        'no gap where the next lens starts less than twice as long',
        [
          [18, 55],
          [70, 300],
        ],
        [],
      ],
      [
        'no gaps in a run of primes a step apart',
        [
          [24, 24],
          [35, 35],
          [50, 50],
          [85, 85],
        ],
        [],
      ],
      [
        'a gap between primes more than twice apart',
        [
          [23, 23],
          [56, 56],
        ],
        [[23, 56]],
      ],
      [
        'no gaps where zooms overlap or meet',
        [
          [24, 70],
          [70, 200],
          [100, 400],
        ],
        [],
      ],
    ],
  )('finds %s', (_name, ranges, gaps) => {
    const body = item({ category: 'camera-body', brand: 'Sony', model: 'A1', mount: 'sony-e' })
    const lenses = ranges.map(([min, max]) =>
      item({
        category: 'lens',
        brand: 'Sony',
        model: `FE ${String(min)}-${String(max)}mm`,
        mount: 'sony-e',
        focalLengthMin: min,
        focalLengthMax: max,
      }),
    )
    const [mapped] = systemMap([body, ...lenses]).bodies
    expect(mapped?.gaps).toEqual(gaps.map(([min, max]) => ({ min, max })))
  })

  it('leaves lenses without focal lengths out of the coverage, listing them last', () => {
    const body = item({ category: 'camera-body', brand: 'Sony', model: 'A1', mount: 'sony-e' })
    const plain = item({ category: 'lens', brand: 'Sony', model: 'FE lens', mount: 'sony-e' })
    const other = item({ category: 'lens', brand: 'Sony', model: 'Another lens', mount: 'sony-e' })
    const prime = item({
      category: 'lens',
      brand: 'Sony',
      model: 'FE 85mm',
      mount: 'sony-e',
      focalLengthMin: 85,
      focalLengthMax: 85,
    })
    const [mapped] = systemMap([plain, body, prime, other]).bodies
    expect(mapped?.lenses.map(({ lens, range }) => [lens.id, range])).toEqual([
      [prime.id, { min: 85, max: 85 }],
      [other.id, undefined],
      [plain.id, undefined],
    ])
    expect(mapped?.covered).toEqual([{ min: 85, max: 85 }])
  })

  it('says what each adapter unlocks, and which unlock nothing yet', () => {
    expect(
      systemMap(EVERYTHING).adapters.map(({ adapter, complete, unlocks }) => [
        `${adapter.brand} ${adapter.model}`,
        complete,
        unlocks.map(({ lens, bodies }) => [`${lens.brand} ${lens.model}`, names(bodies)]),
      ]),
    ).toEqual([
      ['Fotodiox M42 to E', true, []],
      ['Nikon FTZ II', true, [['Nikon AF-S 50mm f/1.8G', ['Nikon Z6 III', 'Nikon Z50 II']]]],
      // Without both mounts, nothing can be worked out
      ['Unknown Adapter', false, []],
    ])
  })

  it('lists the lenses no camera can take, and why', () => {
    expect(
      systemMap(EVERYTHING).unreachable.map(({ lens, reason }) => [
        `${lens.brand} ${lens.model}`,
        reason,
      ]),
    ).toEqual([
      // An EF lens adapts to Sony E and Nikon Z, with an adapter not here
      ['Canon EF 100mm Macro', 'needs-adapter'],
      ['Canon RF 50mm', 'incompatible'],
      ['Old Mystery 35mm', 'unknown'],
    ])
  })

  it('counts only gear you have, not sold, lost, or wished for', () => {
    const map = systemMap([
      z6,
      { ...z50, status: 'wishlist' },
      { ...zoom, status: 'lent-out' },
      { ...tele, status: 'sold' },
      { ...ftz, status: 'lost' },
      fifty,
    ])
    expect(names(map.bodies.map(({ body }) => body))).toEqual(['Nikon Z6 III'])
    expect(lensesOf(map.bodies[0])?.map(([name]) => name)).toEqual(['Nikon Z 24-70mm f/4 S'])
    expect(map.adapters).toEqual([])
    expect(map.unreachable).toEqual([{ lens: fifty, reason: 'needs-adapter' }])
  })

  it('has every lens waiting for a camera when there is none', () => {
    const map = systemMap([zoom, mystery])
    expect(map.bodies).toEqual([])
    expect(map.unreachable.map(({ reason }) => reason)).toEqual(['no-camera', 'no-camera'])
  })

  it('takes no lenses for a camera without a mount', () => {
    const body = item({ category: 'camera-body', brand: 'Leica', model: 'Q3' })
    const map = systemMap([body, zoom])
    expect(map.bodies[0]?.lenses).toEqual([])
    expect(map.unreachable).toEqual([{ lens: zoom, reason: 'unknown' }])
  })
})
