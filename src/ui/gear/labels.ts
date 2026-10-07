// The words for gear fields and sort orders, shared by the list, the detail page, and the form.
import type { Gear, GearFields } from '@/core/gear'
import { MOUNT_LABELS } from '@/core/mounts'
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
