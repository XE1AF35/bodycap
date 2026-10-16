// Converting between what the app works with and what's stored, shared by the repositories and the
// backup store so both read and write records the same way.
import type { Gear } from '@/core/gear'
import { isCurrencyCode } from '@/core/money'
import type { Photo, PhotoInfo } from '@/core/photos'
import { normaliseSerial } from '@/core/serials'
import type { BodycapDatabase, GearRecord, PhotoRecord, SettingRecord } from './db'
import { GearNotFoundError, type Settings } from './repositories'

export function toRecord(gear: Gear): GearRecord {
  const serialKey = normaliseSerial(gear.serialNumber ?? '')
  return serialKey === '' ? { ...gear } : { ...gear, serialKey }
}

// The serial key only serves the index, so the rest of the app never sees it
export function toGear(record: GearRecord): Gear {
  const gear = { ...record }
  delete gear.serialKey
  return gear
}

/** A stored photo's details, leaving its images behind, as a backup's data lists them */
export function toPhotoInfo(photo: PhotoInfo): PhotoInfo {
  const { id, gearId, isCover, mimeType, width, height, bytes, thumbnailBytes } = photo
  const { createdAt, updatedAt } = photo
  return {
    id,
    gearId,
    isCover,
    mimeType,
    width,
    height,
    bytes,
    thumbnailBytes,
    createdAt,
    updatedAt,
  }
}

/** A stored photo as the app shows it, with its thumbnail as a Blob of its own type */
export function toPhoto(record: PhotoRecord): Photo {
  return {
    ...toPhotoInfo(record),
    thumbnail: new Blob([record.thumbnail], { type: record.mimeType }),
  }
}

/**
 * Rejects with GearNotFoundError if any of the items is gone, so a kit or shoot never points at gear
 * that isn't there. Call it inside the write's transaction, which must include gear.
 */
export async function checkGearExists(
  db: BodycapDatabase,
  gearIds: readonly string[],
): Promise<void> {
  const found = await db.gear.bulkGet([...gearIds])
  const missing = gearIds.find((_, index) => found[index] === undefined)
  if (missing !== undefined) throw new GearNotFoundError(missing)
}

/** The keys settings are stored under */
export const SETTING = {
  lastBackupAt: 'lastBackupAt',
  changesSinceBackup: 'changesSinceBackup',
  lastUsedCurrency: 'lastUsedCurrency',
  defaultCurrency: 'defaultCurrency',
  backupReminderDays: 'backupReminderDays',
} as const satisfies Record<keyof Settings, string>

/** A stored count, or 0 if what's stored isn't a count */
function changeCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

/** Adds to the changes since the last backup, one by default. Call it inside the write's transaction. */
export async function countChange(db: BodycapDatabase, changes = 1): Promise<void> {
  if (changes === 0) return
  const stored = await db.settings.get(SETTING.changesSinceBackup)
  await db.settings.put({
    key: SETTING.changesSinceBackup,
    value: changeCount(stored?.value) + changes,
  })
}

/** A whole number of days, from one to a year */
function isReminderDays(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 365
}

// Settings are stored as loose key and value pairs, so each value is checked as it's read
export function toSettings(records: readonly SettingRecord[]): Settings {
  const values = new Map(records.map(({ key, value }) => [key, value]))
  const lastBackupAt = values.get(SETTING.lastBackupAt)
  const currency = (key: string) => {
    const value = values.get(key)
    return typeof value === 'string' && isCurrencyCode(value) ? value : undefined
  }
  const lastUsedCurrency = currency(SETTING.lastUsedCurrency)
  const defaultCurrency = currency(SETTING.defaultCurrency)
  const reminderDays = values.get(SETTING.backupReminderDays)
  return {
    changesSinceBackup: changeCount(values.get(SETTING.changesSinceBackup)),
    ...(typeof lastBackupAt === 'string' ? { lastBackupAt } : {}),
    ...(lastUsedCurrency === undefined ? {} : { lastUsedCurrency }),
    ...(defaultCurrency === undefined ? {} : { defaultCurrency }),
    ...(isReminderDays(reminderDays) ? { backupReminderDays: reminderDays } : {}),
  }
}
