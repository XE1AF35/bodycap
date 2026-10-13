// Filling the gear form from a picked catalogue entry. The entry's facts replace what's in those
// fields, and stay editable. Nothing about someone's own copy, such as its serial number, price,
// dates, or notes, is ever touched.
import type { GearInput } from '../gear'
import { toOpticsInput } from '../optics'
import type { CatalogueEntry } from './schema'

/** The form with `entry`'s facts filled in */
export function fillFromCatalogue(input: GearInput, entry: CatalogueEntry): GearInput {
  const filled = {
    ...input,
    category: entry.category,
    brand: entry.brand,
    model: entry.model,
    mount: entry.mount,
  }
  if (entry.category === 'camera-body') return { ...filled, sensorFormat: entry.sensorFormat }
  // All four optics fields, so a long-end aperture from an earlier pick doesn't linger
  return { ...filled, lensCoverage: entry.lensCoverage, ...toOpticsInput(entry) }
}
