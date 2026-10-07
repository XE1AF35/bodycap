// Whether a lens works on a camera, and how: as it is, through an adapter you have, or not at all.
import { isHeld, type Gear, type GearFields } from './gear'
import { LOCALE } from './locale'
import { ADAPTS_TO, fitsNatively, SENSOR_FORMATS, type MountId, type SensorFormat } from './mounts'

export type Lens = Pick<GearFields, 'mount' | 'lensCoverage'>
export type Body = Pick<GearFields, 'mount' | 'sensorFormat'>
export type Adapter = Pick<Gear, 'id' | 'adapterFrom' | 'adapterTo' | 'adapterAutofocus'>

/** `crop` means the lens covers a smaller format than the sensor, so the camera crops to it */
export type Compatibility =
  | { readonly fit: 'native'; readonly crop: boolean }
  | {
      readonly fit: 'adapter'
      readonly adapterId: string
      readonly autofocus: boolean
      readonly crop: boolean
    }
  | { readonly fit: 'needs-adapter'; readonly crop: boolean }
  | { readonly fit: 'incompatible' }
  | { readonly fit: 'unknown' }

// Formats run from largest to smallest, so a later one is a smaller image circle
function crops(coverage?: SensorFormat, sensor?: SensorFormat): boolean {
  if (coverage === undefined || sensor === undefined) {
    return false
  }
  return SENSOR_FORMATS.indexOf(coverage) > SENSOR_FORMATS.indexOf(sensor)
}

// An adapter has no mirror for the back of an EF-S lens to hit, so EF adapters take EF-S lenses too
function takesLens(adapterFrom: MountId, lens: MountId): boolean {
  return fitsNatively(lens, adapterFrom) || (adapterFrom === 'canon-ef' && lens === 'canon-ef-s')
}

/**
 * Checks a lens against a camera. An adapter you own always counts, even for a pair that isn't
 * usually adapted, since it might have glass in it. Without both mounts, the answer is unknown.
 */
export function checkCompatibility(
  lens: Lens,
  body: Body,
  ownedAdapters: readonly Adapter[],
): Compatibility {
  const lensMount = lens.mount
  const bodyMount = body.mount
  if (lensMount === undefined || bodyMount === undefined) {
    return { fit: 'unknown' }
  }
  const crop = crops(lens.lensCoverage, body.sensorFormat)
  if (fitsNatively(lensMount, bodyMount)) {
    return { fit: 'native', crop }
  }

  const fitting = ownedAdapters.filter(
    ({ adapterFrom, adapterTo }) =>
      adapterFrom !== undefined &&
      adapterTo !== undefined &&
      takesLens(adapterFrom, lensMount) &&
      fitsNatively(adapterTo, bodyMount),
  )
  const adapter = fitting.find(({ adapterAutofocus }) => adapterAutofocus === true) ?? fitting[0]
  if (adapter !== undefined) {
    const autofocus = adapter.adapterAutofocus ?? false
    return { fit: 'adapter', adapterId: adapter.id, autofocus, crop }
  }

  return ADAPTS_TO[lensMount].includes(bodyMount)
    ? { fit: 'needs-adapter', crop }
    : { fit: 'incompatible' }
}

export interface Match {
  /** The camera body for a lens, or the lens for a body */
  readonly gear: Gear
  readonly result: Compatibility
}

// Best fits first: what works as it is, then with an adapter you own, then what you'd need
const RANK: Record<Compatibility['fit'], number> = {
  native: 0,
  adapter: 1,
  'needs-adapter': 2,
  incompatible: 3,
  unknown: 4,
}

const names = new Intl.Collator(LOCALE)
const name = ({ brand, model }: Gear) => `${brand} ${model}`

/**
 * How a lens works with each camera body you have, or a body with each lens you have: the best
 * fits first, then by name. Only gear you have counts, adapters included, though the item itself
 * can be on the wishlist, to see how it would fit in. Undefined for anything but lenses and bodies.
 */
export function compatibleGear(item: Gear, gear: readonly Gear[]): Match[] | undefined {
  const held = gear.filter((other) => other.id !== item.id && isHeld(other.status))
  const adapters = held.filter(({ category }) => category === 'mount-adapter')
  let matches: Match[]
  if (item.category === 'lens') {
    matches = held
      .filter(({ category }) => category === 'camera-body')
      .map((body) => ({ gear: body, result: checkCompatibility(item, body, adapters) }))
  } else if (item.category === 'camera-body') {
    matches = held
      .filter(({ category }) => category === 'lens')
      .map((lens) => ({ gear: lens, result: checkCompatibility(lens, item, adapters) }))
  } else {
    return undefined
  }
  return matches.sort(
    (a, b) => RANK[a.result.fit] - RANK[b.result.fit] || names.compare(name(a.gear), name(b.gear)),
  )
}
