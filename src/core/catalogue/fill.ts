// Filling the gear form from a picked catalogue entry. The entry's facts replace what's in those
// fields, and stay editable. Nothing about someone's own copy, such as its serial number, price,
// dates, or notes, is ever touched. The item stays linked to the entry while its name and mount
// still say that model, since another mount is another version of it.
import type { GearInput } from '../gear'
import { toOpticsInput } from '../optics'
import type { CatalogueEntry } from './schema'

/** The form with `entry`'s facts filled in, linked to the entry */
export function fillFromCatalogue(input: GearInput, entry: CatalogueEntry): GearInput {
  const filled = {
    ...input,
    category: entry.category,
    brand: entry.brand,
    model: entry.model,
    mount: entry.mount,
    catalogueId: entry.id,
    // A model the catalogue has no figure for leaves what's there, rather than wiping a typed one
    ...(entry.weight === undefined ? {} : { weight: String(entry.weight) }),
  }
  if (entry.category === 'camera-body') return { ...filled, sensorFormat: entry.sensorFormat }
  return {
    ...filled,
    lensCoverage: entry.lensCoverage,
    // All four optics fields, so a long-end aperture from an earlier pick doesn't linger
    ...toOpticsInput(entry),
    ...(entry.filterThread === undefined ? {} : { filterThread: String(entry.filterThread) }),
  }
}

/** The brand, model, and mount an item was linked under */
export interface LinkedModel {
  readonly brand: string
  readonly model: string
  readonly mount: string
}

// Case and spacing don't make a different model
const nameKey = ({ brand, model }: Pick<LinkedModel, 'brand' | 'model'>) =>
  `${brand} ${model}`.toLowerCase().replaceAll(/\s+/g, '')

/**
 * The form as it should be saved: still linked to its catalogue model while the brand, model, and
 * mount are the ones it was `linked` under, and unlinked once they say something else.
 */
export function keepCatalogueLink(input: GearInput, linked: LinkedModel | undefined): GearInput {
  if (linked !== undefined && nameKey(input) === nameKey(linked) && input.mount === linked.mount) {
    return input
  }
  return { ...input, catalogueId: '' }
}
