// How the gear you have fits together: which lenses each camera takes, as they are or through an
// adapter you own, what each adapter unlocks, the lenses no camera here can take, and the focal
// lengths each camera covers, with the gaps between.
import { checkCompatibility, type Compatibility } from './compatibility'
import { isHeld, type Gear } from './gear'
import { LOCALE } from './locale'
import { CROP_FACTORS } from './mounts'

/** Millimetres, from shortest to longest. A prime is a single point. */
export interface FocalRange {
  readonly min: number
  readonly max: number
}

export interface MappedLens {
  readonly lens: Gear
  readonly result: Extract<Compatibility, { readonly fit: 'native' | 'adapter' }>
  /**
   * Its focal lengths as this camera frames them. A lens made for a smaller sensor is cropped, so
   * it frames like a longer lens. Undefined when its focal lengths aren't recorded.
   */
  readonly range?: FocalRange
}

export interface BodyMap {
  readonly body: Gear
  /** By focal length, shortest first, then by name. Lenses without focal lengths come last. */
  readonly lenses: readonly MappedLens[]
  /** The focal lengths its lenses cover, joined where they overlap or meet */
  readonly covered: readonly FocalRange[]
  /** Where the next lens starts at twice or more the focal length the last one ends at */
  readonly gaps: readonly FocalRange[]
}

export interface AdapterMap {
  readonly adapter: Gear
  /** Both its mounts are recorded, so what it unlocks can be worked out */
  readonly complete: boolean
  /** Lenses that reach cameras only through this adapter, and which cameras */
  readonly unlocks: readonly { readonly lens: Gear; readonly bodies: readonly Gear[] }[]
}

export type UnreachableReason =
  /** An adapter not here would bring it to a camera you have */
  | 'needs-adapter'
  /** Nothing brings it to any camera you have */
  | 'incompatible'
  /** A mount isn't recorded, the lens's or the cameras' */
  | 'unknown'
  /** There's no camera body yet */
  | 'no-camera'

export interface UnreachableLens {
  readonly lens: Gear
  readonly reason: UnreachableReason
}

export interface SystemMap {
  readonly bodies: readonly BodyMap[]
  readonly adapters: readonly AdapterMap[]
  readonly unreachable: readonly UnreachableLens[]
}

/** The next lens must start at this many times the last one's longest to leave a gap */
const GAP_RATIO = 2

const collator = new Intl.Collator(LOCALE, { numeric: true })
const byName = (a: Gear, b: Gear) =>
  collator.compare(`${a.brand} ${a.model}`, `${b.brand} ${b.model}`)

function rangeOn(lens: Gear, body: Gear, crop: boolean): FocalRange | undefined {
  const { focalLengthMin: min, focalLengthMax: max, lensCoverage } = lens
  if (min === undefined || max === undefined) return undefined
  const { sensorFormat } = body
  // Cropping only happens with both formats known, as checkCompatibility worked out
  const factor =
    crop && lensCoverage !== undefined && sensorFormat !== undefined
      ? CROP_FACTORS[lensCoverage] / CROP_FACTORS[sensorFormat]
      : 1
  return factor === 1
    ? { min, max }
    : { min: Math.round(min * factor), max: Math.round(max * factor) }
}

/** Joins ranges that overlap or meet, shortest first */
function join(ranges: readonly FocalRange[]): FocalRange[] {
  const joined: FocalRange[] = []
  for (const range of [...ranges].sort((a, b) => a.min - b.min || a.max - b.max)) {
    const last = joined.at(-1)
    if (last !== undefined && range.min <= last.max) {
      joined[joined.length - 1] = { min: last.min, max: Math.max(last.max, range.max) }
    } else {
      joined.push(range)
    }
  }
  return joined
}

function gapsIn(covered: readonly FocalRange[]): FocalRange[] {
  return covered.slice(1).flatMap((next, index) => {
    const previous = covered[index]
    return previous !== undefined && next.min >= previous.max * GAP_RATIO
      ? [{ min: previous.max, max: next.min }]
      : []
  })
}

function mapBody(body: Gear, lenses: readonly Gear[], adapters: readonly Gear[]): BodyMap {
  const mapped = lenses.flatMap((lens): MappedLens[] => {
    const result = checkCompatibility(lens, body, adapters)
    if (result.fit !== 'native' && result.fit !== 'adapter') return []
    const range = rangeOn(lens, body, result.crop)
    return [range === undefined ? { lens, result } : { lens, result, range }]
  })
  mapped.sort(
    (a, b) =>
      (a.range?.min ?? Infinity) - (b.range?.min ?? Infinity) ||
      (a.range?.max ?? Infinity) - (b.range?.max ?? Infinity) ||
      byName(a.lens, b.lens),
  )
  const covered = join(mapped.flatMap(({ range }) => (range === undefined ? [] : [range])))
  return { body, lenses: mapped, covered, gaps: gapsIn(covered) }
}

function mapAdapter(adapter: Gear, lenses: readonly Gear[], bodies: readonly Gear[]): AdapterMap {
  const complete = adapter.adapterFrom !== undefined && adapter.adapterTo !== undefined
  const unlocks = lenses.flatMap((lens) => {
    const through = bodies.filter(
      (body) => checkCompatibility(lens, body, [adapter]).fit === 'adapter',
    )
    return through.length === 0 ? [] : [{ lens, bodies: through }]
  })
  return { adapter, complete, unlocks }
}

/** The nearest the lens comes to any camera here, given that none takes it */
function whyUnreachable(lens: Gear, bodies: readonly Gear[]): UnreachableReason {
  if (bodies.length === 0) return 'no-camera'
  const fits = bodies.map((body) => checkCompatibility(lens, body, []).fit)
  if (fits.includes('needs-adapter')) return 'needs-adapter'
  if (fits.includes('incompatible')) return 'incompatible'
  return 'unknown'
}

/** The map of the gear you have: owned, lent out, or in repair */
export function systemMap(gear: readonly Gear[]): SystemMap {
  const held = gear.filter(({ status }) => isHeld(status)).sort(byName)
  const of = (category: Gear['category']) => held.filter((item) => item.category === category)
  const bodies = of('camera-body')
  const lenses = of('lens')
  const adapters = of('mount-adapter')

  const bodyMaps = bodies.map((body) => mapBody(body, lenses, adapters))
  const reached = new Set(
    bodyMaps.flatMap(({ lenses: mapped }) => mapped.map(({ lens }) => lens.id)),
  )
  return {
    bodies: bodyMaps,
    adapters: adapters.map((adapter) => mapAdapter(adapter, lenses, bodies)),
    unreachable: lenses
      .filter(({ id }) => !reached.has(id))
      .map((lens) => ({ lens, reason: whyUnreachable(lens, bodies) })),
  }
}
