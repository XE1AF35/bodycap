// Whether a lens works on a camera, and how: as it is, through an adapter you have, or not at all.
import type { Gear, GearFields } from './gear'
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
