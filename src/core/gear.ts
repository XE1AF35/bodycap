// Gear records, and the rules for turning what someone typed into the gear form into a clean record.
// The rules live here so the form, backups, and tests all agree on what a valid item is.
import { isCatalogueId } from './catalogue/id'
import { isOneOf } from './choice'
import { isIsoDate, type IsoDate } from './dates'
import { LOCALE } from './locale'
import {
  DEFAULT_CURRENCY,
  isCurrencyCode,
  parseAmount,
  toAmountInput,
  type CurrencyCode,
  type Money,
} from './money'
import { MOUNTS, SENSOR_FORMATS, type MountId, type SensorFormat } from './mounts'
import {
  OPTICS_FIELDS,
  toOpticsInput,
  validateOptics,
  type LensOptics,
  type OpticsInput,
} from './optics'
import { err, ok, type Result } from './result'
import { characterCount, cleanLine, cleanMultiline } from './text'

// Records store these IDs, never the labels, so the wording can change without touching saved data

export const CATEGORIES = [
  'camera-body',
  'lens',
  'flash',
  'tripod',
  'bag',
  'filter',
  'memory-card',
  'battery',
  'drone',
  'mount-adapter',
  'accessory',
  'other',
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  'camera-body': 'Camera body',
  lens: 'Lens',
  flash: 'Flash',
  tripod: 'Tripod',
  bag: 'Bag',
  filter: 'Filter',
  'memory-card': 'Memory card',
  battery: 'Battery',
  drone: 'Drone',
  'mount-adapter': 'Mount adapter',
  accessory: 'Accessory',
  other: 'Other',
}

export const STATUSES = ['owned', 'wishlist', 'lent-out', 'in-repair', 'sold', 'lost'] as const

export type Status = (typeof STATUSES)[number]

export const STATUS_LABELS: Record<Status, string> = {
  owned: 'Owned',
  wishlist: 'Wishlist',
  'lent-out': 'Lent out',
  'in-repair': 'In repair',
  sold: 'Sold',
  lost: 'Lost',
}

const HELD: ReadonlySet<Status> = new Set(['owned', 'lent-out', 'in-repair'])

/** Whether you have the item, even while it's lent out or being repaired. */
export function isHeld(status: Status): boolean {
  return HELD.has(status)
}

export const CONDITIONS = [
  'new',
  'like-new',
  'excellent',
  'good',
  'fair',
  'poor',
  'for-parts',
] as const

export type Condition = (typeof CONDITIONS)[number]

export const CONDITION_LABELS: Record<Condition, string> = {
  new: 'New',
  'like-new': 'Like new',
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  'for-parts': 'For parts',
}

/** A gear item's details: everything except its ID and timestamps. Only lenses have optics. */
export interface GearFields extends LensOptics {
  readonly category: Category
  readonly brand: string
  readonly model: string
  readonly nickname?: string
  readonly serialNumber?: string
  /** Camera bodies and lenses */
  readonly mount?: MountId
  /** Camera bodies: the size of the sensor */
  readonly sensorFormat?: SensorFormat
  /** Lenses: the sensor size the lens is made for */
  readonly lensCoverage?: SensorFormat
  /** Lenses and filters: the filter thread's diameter in millimetres, such as 77 or 40.5 */
  readonly filterThread?: number
  /** In whole grams */
  readonly weight?: number
  /** Camera bodies and lenses: the catalogue model it was filled from, such as "sony-a7-iv" */
  readonly catalogueId?: string
  /** Mount adapters: the lens side */
  readonly adapterFrom?: MountId
  /** Mount adapters: the camera side */
  readonly adapterTo?: MountId
  /** Mount adapters: whether autofocus still works through it */
  readonly adapterAutofocus?: boolean
  readonly purchaseDate?: IsoDate
  readonly purchasePrice?: Money
  readonly whereBought?: string
  readonly condition?: Condition
  readonly status: Status
  readonly currentLocation?: string
  readonly warrantyExpiry?: IsoDate
  readonly insuredValue?: Money
  readonly saleDate?: IsoDate
  readonly salePrice?: Money
  readonly lostDate?: IsoDate
  readonly notes?: string
}

export interface Gear extends GearFields {
  readonly id: string
  /** ISO 8601 UTC timestamps */
  readonly createdAt: string
  readonly updatedAt: string
}

export type OptionalField = Exclude<keyof GearFields, 'category' | 'brand' | 'model' | 'status'>

export interface MoneyInput {
  readonly amount: string
  readonly currency: string
}

/** What the gear form holds: everything as typed or picked, before any checks */
export interface GearInput extends OpticsInput {
  readonly category: string
  readonly brand: string
  readonly model: string
  readonly nickname: string
  readonly serialNumber: string
  readonly mount: string
  readonly sensorFormat: string
  readonly lensCoverage: string
  readonly filterThread: string
  readonly weight: string
  /** Set when a catalogue model is picked, and never typed */
  readonly catalogueId: string
  readonly adapterFrom: string
  readonly adapterTo: string
  readonly adapterAutofocus: boolean
  readonly purchaseDate: string
  readonly purchasePrice: MoneyInput
  readonly whereBought: string
  readonly condition: string
  readonly status: string
  readonly currentLocation: string
  readonly warrantyExpiry: string
  readonly insuredValue: MoneyInput
  readonly saleDate: string
  readonly salePrice: MoneyInput
  readonly lostDate: string
  readonly notes: string
}

/** One plain-English message per field that needs fixing */
export type GearErrors = Partial<Record<keyof GearInput, string>>

const ALWAYS: readonly OptionalField[] = [
  'nickname',
  'purchasePrice',
  'whereBought',
  'condition',
  'currentLocation',
  'notes',
  'weight',
]

// Something on the wishlist hasn't been bought yet, so it has no serial, purchase date, or cover
const ONCE_BOUGHT: readonly OptionalField[] = [
  'serialNumber',
  'purchaseDate',
  'warrantyExpiry',
  'insuredValue',
]

const BY_CATEGORY: Partial<Record<Category, readonly OptionalField[]>> = {
  'camera-body': ['mount', 'sensorFormat', 'catalogueId'],
  lens: ['mount', 'lensCoverage', ...OPTICS_FIELDS, 'filterThread', 'catalogueId'],
  filter: ['filterThread'],
  'mount-adapter': ['adapterFrom', 'adapterTo', 'adapterAutofocus'],
}

const BY_STATUS: Partial<Record<Status, readonly OptionalField[]>> = {
  sold: ['saleDate', 'salePrice'],
  lost: ['lostDate'],
}

/**
 * The optional fields that make sense for an item. The form shows only these, and validation drops
 * the rest, so a value left behind after changing the category or status is never saved.
 */
export function applicableFields(category: Category, status: Status): ReadonlySet<OptionalField> {
  return new Set([
    ...ALWAYS,
    ...(status === 'wishlist' ? [] : ONCE_BOUGHT),
    ...(BY_CATEGORY[category] ?? []),
    ...(BY_STATUS[status] ?? []),
  ])
}

const MAX_LENGTH = {
  brand: 80,
  model: 120,
  nickname: 80,
  serialNumber: 64,
  whereBought: 120,
  currentLocation: 120,
  notes: 5000,
} as const

type TextField = keyof typeof MAX_LENGTH

const TEXT_NAMES: Record<TextField, string> = {
  brand: 'the brand',
  model: 'the model',
  nickname: 'the nickname',
  serialNumber: 'the serial number',
  whereBought: 'where you bought it',
  currentLocation: 'the location',
  notes: 'the notes',
}

type DateField = 'purchaseDate' | 'warrantyExpiry' | 'saleDate' | 'lostDate'
type MoneyField = 'purchasePrice' | 'insuredValue' | 'salePrice'
type ChoiceField =
  'mount' | 'sensorFormat' | 'lensCoverage' | 'adapterFrom' | 'adapterTo' | 'condition'

type Writable<T> = { -readonly [K in keyof T]: T[K] }

const countFormat = new Intl.NumberFormat(LOCALE)

/** In grams: from a lens cap to a loaded cine rig */
export const WEIGHT_RANGE = { min: 1, max: 50_000 } as const

/** In millimetres: from the smallest step-up rings to the largest screw-in filters */
export const FILTER_THREAD_RANGE = { min: 10, max: 200 } as const

type MeasureField = 'weight' | 'filterThread'

interface Measure {
  readonly pattern: RegExp
  readonly range: { readonly min: number; readonly max: number }
  readonly unit: string
  readonly name: string
  readonly unclear: string
}

const MEASURES: Record<MeasureField, Measure> = {
  weight: {
    // Whole grams, with or without "g", and with or without commas between thousands
    pattern: /^(\d{1,3}(?:,\d{3})+|\d+)\s*g?$/i,
    range: WEIGHT_RANGE,
    unit: 'g',
    name: 'a weight',
    unclear: 'Enter the weight in whole grams, such as 658.',
  },
  filterThread: {
    // Most are whole millimetres, but some small lenses take 40.5 or 37.5
    pattern: /^(\d{1,3}(?:\.\d)?)\s*(?:mm)?$/i,
    range: FILTER_THREAD_RANGE,
    unit: 'mm',
    name: 'a filter thread',
    unclear: 'Enter the filter thread in millimetres, such as 77.',
  },
}

/** Checks the form's input against every rule. All problems are reported together, not one at a time. */
export function validateGear(input: GearInput, today: IsoDate): Result<GearFields, GearErrors> {
  const errors: GearErrors = {}

  const category = isOneOf(CATEGORIES, input.category) ? input.category : undefined
  if (category === undefined) errors.category = 'Choose a category.'
  const status = isOneOf(STATUSES, input.status) ? input.status : undefined
  if (status === undefined) errors.status = 'Choose a status.'
  // Until a valid category and status are picked, only the fields every item has are checked
  const applies = applicableFields(category ?? 'other', status ?? 'owned')

  const text = (field: TextField, clean: (value: string) => string = cleanLine) => {
    const value = clean(input[field])
    if (value === '') return undefined
    if (characterCount(value) > MAX_LENGTH[field]) {
      const max = countFormat.format(MAX_LENGTH[field])
      errors[field] = `Keep ${TEXT_NAMES[field]} to ${max} characters or fewer.`
      return undefined
    }
    return value
  }
  const optionalText = (field: TextField & OptionalField, clean?: (value: string) => string) =>
    applies.has(field) ? text(field, clean) : undefined

  const choice = <T extends string>(field: ChoiceField, choices: readonly T[], message: string) => {
    const value = input[field].trim()
    if (!applies.has(field) || value === '') return undefined
    if (!isOneOf(choices, value)) {
      errors[field] = message
      return undefined
    }
    return value
  }

  const date = (field: DateField): IsoDate | undefined => {
    const value = input[field].trim()
    if (!applies.has(field) || value === '') return undefined
    if (!isIsoDate(value)) {
      errors[field] = 'Enter a real date.'
      return undefined
    }
    return value
  }

  const money = (field: MoneyField): Money | undefined => {
    const { amount, currency } = input[field]
    if (!applies.has(field) || amount.trim() === '') return undefined
    if (!isCurrencyCode(currency)) {
      errors[field] = 'Choose a currency.'
      return undefined
    }
    const parsed = parseAmount(amount, currency)
    if (!parsed.ok) {
      errors[field] = parsed.error
      return undefined
    }
    return { amountMinor: parsed.value, currency }
  }

  const brand = text('brand')
  if (brand === undefined) errors.brand ??= 'Enter the brand.'
  const model = text('model')
  if (model === undefined) errors.model ??= 'Enter the model.'
  const nickname = optionalText('nickname')
  const serialNumber = optionalText('serialNumber')
  const whereBought = optionalText('whereBought')
  const currentLocation = optionalText('currentLocation')
  const notes = optionalText('notes', cleanMultiline)

  const measure = (field: MeasureField): number | undefined => {
    const { pattern, range, unit, name, unclear } = MEASURES[field]
    const value = input[field].trim()
    if (!applies.has(field) || value === '') return undefined
    const digits = pattern.exec(value)?.[1]
    if (digits === undefined) {
      errors[field] = unclear
      return undefined
    }
    const number = Number(digits.replaceAll(',', ''))
    if (number < range.min || number > range.max) {
      const min = countFormat.format(range.min)
      const max = countFormat.format(range.max)
      errors[field] = `Enter ${name} from ${min} to ${max} ${unit}.`
      return undefined
    }
    return number
  }

  const weight = measure('weight')
  const filterThread = measure('filterThread')
  // Never shown, so a broken one is dropped rather than reported
  const typedId = input.catalogueId.trim()
  const catalogueId = applies.has('catalogueId') && isCatalogueId(typedId) ? typedId : undefined

  const pickMount = 'Choose a mount from the list.'
  const pickFormat = 'Choose a sensor format from the list.'
  const mount = choice('mount', MOUNTS, pickMount)
  const sensorFormat = choice('sensorFormat', SENSOR_FORMATS, pickFormat)
  const lensCoverage = choice('lensCoverage', SENSOR_FORMATS, pickFormat)
  const adapterFrom = choice('adapterFrom', MOUNTS, pickMount)
  const adapterTo = choice('adapterTo', MOUNTS, pickMount)
  if (adapterFrom !== undefined && adapterFrom === adapterTo) {
    errors.adapterTo = 'An adapter joins two different mounts.'
  }
  const condition = choice('condition', CONDITIONS, 'Choose a condition from the list.')

  const purchasePrice = money('purchasePrice')
  const insuredValue = money('insuredValue')
  const salePrice = money('salePrice')

  // Valid dates compare correctly as plain YYYY-MM-DD strings
  const purchaseDate = date('purchaseDate')
  if (purchaseDate !== undefined && purchaseDate > today) {
    errors.purchaseDate = "The purchase date can't be in the future."
  }
  const boughtAfter = (when: IsoDate) => purchaseDate !== undefined && when < purchaseDate

  const warrantyExpiry = date('warrantyExpiry')
  if (warrantyExpiry !== undefined && boughtAfter(warrantyExpiry)) {
    errors.warrantyExpiry = "The warranty can't end before the purchase date."
  }

  const saleDate = date('saleDate')
  if (status === 'sold') {
    if (saleDate === undefined) errors.saleDate ??= 'Enter the date it was sold.'
    else if (saleDate > today) errors.saleDate = "The sale date can't be in the future."
    else if (boughtAfter(saleDate)) {
      errors.saleDate = "The sale date can't be before the purchase date."
    }
    if (salePrice === undefined) errors.salePrice ??= 'Enter what it sold for.'
  }

  // Lenses only. The optics rules live with the optics, and report problems the same way.
  const optics = applies.has('focalLengthMin') ? validateOptics(input) : ok<LensOptics>({})
  if (!optics.ok) Object.assign(errors, optics.error)
  const opticsFields = optics.ok ? optics.value : {}

  const lostDate = date('lostDate')
  if (status === 'lost') {
    if (lostDate === undefined) errors.lostDate ??= 'Enter the date it was lost.'
    else if (lostDate > today) errors.lostDate = "The date it was lost can't be in the future."
    else if (boughtAfter(lostDate)) {
      errors.lostDate = "It can't have been lost before the purchase date."
    }
  }

  if (
    category === undefined ||
    status === undefined ||
    brand === undefined ||
    model === undefined ||
    Object.keys(errors).length > 0
  ) {
    return err(errors)
  }

  // Optional fields are only set when they have a value, so stored records stay small
  const fields: Writable<GearFields> = { category, brand, model, status }
  if (nickname !== undefined) fields.nickname = nickname
  if (serialNumber !== undefined) fields.serialNumber = serialNumber
  if (mount !== undefined) fields.mount = mount
  if (sensorFormat !== undefined) fields.sensorFormat = sensorFormat
  if (lensCoverage !== undefined) fields.lensCoverage = lensCoverage
  Object.assign(fields, opticsFields)
  if (filterThread !== undefined) fields.filterThread = filterThread
  if (weight !== undefined) fields.weight = weight
  if (catalogueId !== undefined) fields.catalogueId = catalogueId
  if (adapterFrom !== undefined) fields.adapterFrom = adapterFrom
  if (adapterTo !== undefined) fields.adapterTo = adapterTo
  if (applies.has('adapterAutofocus')) fields.adapterAutofocus = input.adapterAutofocus
  if (purchaseDate !== undefined) fields.purchaseDate = purchaseDate
  if (purchasePrice !== undefined) fields.purchasePrice = purchasePrice
  if (whereBought !== undefined) fields.whereBought = whereBought
  if (condition !== undefined) fields.condition = condition
  if (currentLocation !== undefined) fields.currentLocation = currentLocation
  if (warrantyExpiry !== undefined) fields.warrantyExpiry = warrantyExpiry
  if (insuredValue !== undefined) fields.insuredValue = insuredValue
  if (saleDate !== undefined) fields.saleDate = saleDate
  if (salePrice !== undefined) fields.salePrice = salePrice
  if (lostDate !== undefined) fields.lostDate = lostDate
  if (notes !== undefined) fields.notes = notes
  return ok(fields)
}

/** A blank form for a new item: owned, with every amount in `currency` until someone changes it. */
export function emptyGearInput(currency: CurrencyCode = DEFAULT_CURRENCY): GearInput {
  const noAmount = { amount: '', currency }
  return {
    category: '',
    brand: '',
    model: '',
    nickname: '',
    serialNumber: '',
    mount: '',
    sensorFormat: '',
    lensCoverage: '',
    filterThread: '',
    weight: '',
    catalogueId: '',
    adapterFrom: '',
    adapterTo: '',
    adapterAutofocus: false,
    focalLengthMin: '',
    focalLengthMax: '',
    maxAperture: '',
    maxApertureTele: '',
    purchaseDate: '',
    purchasePrice: noAmount,
    whereBought: '',
    condition: '',
    status: 'owned',
    currentLocation: '',
    warrantyExpiry: '',
    insuredValue: noAmount,
    saleDate: '',
    salePrice: noAmount,
    lostDate: '',
    notes: '',
  }
}

/** Fills the form from a saved item. Blank amounts start in `currency`. */
export function toGearInput(
  fields: GearFields,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): GearInput {
  const amount = (money?: Money): MoneyInput =>
    money ? { amount: toAmountInput(money), currency: money.currency } : { amount: '', currency }
  return {
    category: fields.category,
    brand: fields.brand,
    model: fields.model,
    nickname: fields.nickname ?? '',
    serialNumber: fields.serialNumber ?? '',
    mount: fields.mount ?? '',
    sensorFormat: fields.sensorFormat ?? '',
    lensCoverage: fields.lensCoverage ?? '',
    filterThread: fields.filterThread === undefined ? '' : String(fields.filterThread),
    weight: fields.weight === undefined ? '' : String(fields.weight),
    catalogueId: fields.catalogueId ?? '',
    adapterFrom: fields.adapterFrom ?? '',
    adapterTo: fields.adapterTo ?? '',
    adapterAutofocus: fields.adapterAutofocus ?? false,
    ...toOpticsInput(fields),
    purchaseDate: fields.purchaseDate ?? '',
    purchasePrice: amount(fields.purchasePrice),
    whereBought: fields.whereBought ?? '',
    condition: fields.condition ?? '',
    status: fields.status,
    currentLocation: fields.currentLocation ?? '',
    warrantyExpiry: fields.warrantyExpiry ?? '',
    insuredValue: amount(fields.insuredValue),
    saleDate: fields.saleDate ?? '',
    salePrice: amount(fields.salePrice),
    lostDate: fields.lostDate ?? '',
    notes: fields.notes ?? '',
  }
}
