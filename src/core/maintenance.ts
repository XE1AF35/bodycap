// The maintenance log: sensor cleans, firmware updates, repairs, and anything else done to an item,
// with when it was done, what it cost, and who did it.
import { isOneOf } from './choice'
import type { IsoDate } from './dates'
import { fieldErrors, readDate, readMoney, readText } from './fields'
import type { MoneyInput } from './gear'
import { toAmountInput, type CurrencyCode, type Money } from './money'
import { err, ok, type Result } from './result'

// Records store these IDs, never the labels, so the wording can change without touching saved data
export const MAINTENANCE_TYPES = ['sensor-clean', 'firmware-update', 'repair', 'other'] as const

export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number]

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  'sensor-clean': 'Sensor clean',
  'firmware-update': 'Firmware update',
  repair: 'Repair',
  other: 'Other',
}

export interface MaintenanceFields {
  readonly gearId: string
  readonly type: MaintenanceType
  readonly date: IsoDate
  readonly cost?: Money
  /** Who did it, such as a repair shop, or yourself */
  readonly provider?: string
  /** Firmware updates only: the version installed */
  readonly firmwareVersion?: string
  readonly notes?: string
}

export interface MaintenanceRecord extends MaintenanceFields {
  readonly id: string
  /** ISO 8601 UTC timestamps */
  readonly createdAt: string
  readonly updatedAt: string
}

/** What the maintenance form decides; the page supplies the item */
export type MaintenanceDetails = Omit<MaintenanceFields, 'gearId'>

/** What the maintenance form holds, as typed or picked */
export interface MaintenanceInput {
  readonly type: string
  readonly date: string
  readonly cost: MoneyInput
  readonly provider: string
  readonly firmwareVersion: string
  readonly notes: string
}

export type MaintenanceErrors = Partial<Record<keyof MaintenanceInput, string>>

/** A blank form for work done today, with the cost in `currency` until someone changes it */
export function emptyMaintenanceInput(today: IsoDate, currency: CurrencyCode): MaintenanceInput {
  return {
    type: '',
    date: today,
    cost: { amount: '', currency },
    provider: '',
    firmwareVersion: '',
    notes: '',
  }
}

/** Fills the form from a saved record. A blank cost starts in `currency`. */
export function toMaintenanceInput(
  record: MaintenanceDetails,
  currency: CurrencyCode,
): MaintenanceInput {
  return {
    type: record.type,
    date: record.date,
    cost: record.cost
      ? { amount: toAmountInput(record.cost), currency: record.cost.currency }
      : { amount: '', currency },
    provider: record.provider ?? '',
    firmwareVersion: record.firmwareVersion ?? '',
    notes: record.notes ?? '',
  }
}

/** Checks a maintenance record as typed. All problems are reported together. */
export function validateMaintenance(
  input: MaintenanceInput,
  today: IsoDate,
): Result<MaintenanceDetails, MaintenanceErrors> {
  const { errors, take } = fieldErrors<keyof MaintenanceInput>()

  const type = isOneOf(MAINTENANCE_TYPES, input.type) ? input.type : undefined
  if (type === undefined) errors.type = 'Choose what was done.'

  // Valid dates compare correctly as plain YYYY-MM-DD strings
  const date = take('date', readDate(input.date))
  if (date === undefined) errors.date ??= 'Enter the date it was done.'
  else if (date > today) errors.date = "The date can't be in the future."

  const cost = take('cost', readMoney(input.cost))
  const provider = take('provider', readText(input.provider, { max: 120, name: 'who did it' }))
  // A version left over from choosing firmware update first is dropped, as the form hides it
  const firmwareVersion =
    type === 'firmware-update'
      ? take(
          'firmwareVersion',
          readText(input.firmwareVersion, { max: 40, name: 'the firmware version' }),
        )
      : undefined
  const notes = take(
    'notes',
    readText(input.notes, { max: 2000, name: 'the notes', multiline: true }),
  )

  if (type === undefined || date === undefined || Object.keys(errors).length > 0) {
    return err(errors)
  }
  return ok({
    type,
    date,
    ...(cost !== undefined ? { cost } : {}),
    ...(provider !== undefined ? { provider } : {}),
    ...(firmwareVersion !== undefined ? { firmwareVersion } : {}),
    ...(notes !== undefined ? { notes } : {}),
  })
}

/** An item's maintenance, most recent first. Work done on the same day keeps the order it was given. */
export function maintenanceHistory<T extends MaintenanceFields>(
  records: readonly T[],
  gearId: string,
): T[] {
  // Valid dates sort correctly as plain YYYY-MM-DD strings, and sort is stable
  return records
    .filter((record) => record.gearId === gearId)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
}

/** The most recent work of one type on an item, such as its last sensor clean */
export function lastDone<T extends MaintenanceFields>(
  records: readonly T[],
  gearId: string,
  type: MaintenanceType,
): T | undefined {
  return maintenanceHistory(records, gearId).find((record) => record.type === type)
}
