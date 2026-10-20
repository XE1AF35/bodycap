// The words for gear fields and sort orders, shared by the list, the detail page, and the form.
import type { CatalogueEntry } from '@/core/catalogue/schema'
import { CATEGORY_LABELS, type Gear, type GearFields } from '@/core/gear'
import { MOUNT_CODES, MOUNT_LABELS, SENSOR_FORMAT_LABELS } from '@/core/mounts'
import { formatAperture, formatFocalLength } from '@/core/optics'
import type { SortKey } from '@/core/search'

export const FIELD_LABELS: Record<keyof GearFields, string> = {
  category: 'Category',
  brand: 'Brand',
  model: 'Model',
  nickname: 'Nickname',
  serialNumber: 'Serial number',
  mount: 'Mount',
  sensorFormat: 'Sensor format',
  lensCoverage: 'Lens coverage',
  filterThread: 'Filter thread',
  weight: 'Weight',
  catalogueId: 'Catalogue ID',
  adapterFrom: 'Lens side',
  adapterTo: 'Camera side',
  adapterAutofocus: 'Autofocus',
  focalLengthMin: 'Shortest focal length',
  focalLengthMax: 'Longest focal length',
  maxAperture: 'Widest aperture',
  maxApertureTele: 'Widest aperture at the long end',
  purchaseDate: 'Purchase date',
  purchasePrice: 'Purchase price',
  whereBought: 'Where bought',
  condition: 'Condition',
  status: 'Status',
  currentLocation: 'Location',
  warrantyExpiry: 'Warranty ends',
  insuredValue: 'Insured value',
  ownEstimate: 'Your own estimate',
  ownEstimateDate: 'Own estimate set',
  saleDate: 'Sale date',
  salePrice: 'Sale price',
  lostDate: 'Date lost',
  notes: 'Notes',
}

/** Such as "Sony FE 24-70mm F2.8 GM II" */
export function gearName({ brand, model }: Pick<Gear, 'brand' | 'model'>): string {
  return `${brand} ${model}`
}

/** A body or lens's mount, or the two sides of an adapter, such as "Nikon F to Nikon Z" */
export function mountText({
  mount,
  adapterFrom,
  adapterTo,
}: Pick<Gear, 'mount' | 'adapterFrom' | 'adapterTo'>): string | undefined {
  if (mount !== undefined) return MOUNT_LABELS[mount]
  if (adapterFrom !== undefined && adapterTo !== undefined) {
    return `${MOUNT_LABELS[adapterFrom]} to ${MOUNT_LABELS[adapterTo]}`
  }
  return undefined
}

/** Each sort order's name, going up then going down */
export const SORT_LABELS: Record<SortKey, readonly [string, string]> = {
  name: ['Name, A to Z', 'Name, Z to A'],
  category: ['Category, A to Z', 'Category, Z to A'],
  status: ['Status, A to Z', 'Status, Z to A'],
  purchaseDate: ['Purchase date, oldest first', 'Purchase date, newest first'],
  updatedAt: ['Last changed, oldest first', 'Last changed, newest first'],
}

/** What a suggested model is: its category, mount, and sensor format, or a lens's coverage and optics */
export function catalogueDetails(entry: CatalogueEntry): string {
  const parts = [CATEGORY_LABELS[entry.category], `${MOUNT_CODES[entry.mount]} mount`]
  if (entry.category === 'camera-body') parts.push(SENSOR_FORMAT_LABELS[entry.sensorFormat])
  else {
    parts.push(SENSOR_FORMAT_LABELS[entry.lensCoverage])
    parts.push(`${formatFocalLength(entry) ?? ''} ${formatAperture(entry) ?? ''}`.trim())
  }
  return parts.join(' \u00b7 ')
}

/** Said after a model is picked: what it filled in, and that it can all be changed */
export function catalogueFilled(entry: CatalogueEntry): string {
  const filled = ['category', 'brand', 'mount']
  if (entry.category === 'camera-body') filled.push('sensor format')
  else {
    filled.push('lens coverage', 'focal length', 'aperture')
    if (entry.filterThread !== undefined) filled.push('filter thread')
  }
  if (entry.weight !== undefined) filled.push('weight')
  const last = filled.pop() ?? ''
  return `Filled in the ${filled.join(', ')}, and ${last}. Change anything that's different on yours.`
}
