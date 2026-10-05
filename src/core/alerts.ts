// What the dashboard flags: warranties running out, backups falling behind, storage filling up, and
// items entered twice. Each check is pure, so the dashboard just reads the list.
import { daysBetween, type IsoDate } from './dates'
import { isHeld, type Gear } from './gear'
import { findDuplicateSerials, type DuplicateSerial } from './serials'

export const WARRANTY_DAYS_AHEAD = 60
export const WARRANTY_DAYS_AFTER = 30
export const BACKUP_DUE_DAYS = 14
export const BACKUP_DUE_CHANGES = 20
export const STORAGE_NEARLY_FULL = 0.8

export type AlertItem = Pick<Gear, 'id' | 'brand' | 'status' | 'serialNumber' | 'warrantyExpiry'>

export interface WarrantyAlert {
  readonly id: string
  readonly warrantyExpiry: IsoDate
  /** Negative once the warranty has ended */
  readonly daysLeft: number
}

/** Gear you have whose warranty ends soon or ended recently, earliest first. */
export function expiringWarranties(items: Iterable<AlertItem>, today: IsoDate): WarrantyAlert[] {
  const alerts: WarrantyAlert[] = []
  for (const { id, status, warrantyExpiry } of items) {
    if (warrantyExpiry === undefined || !isHeld(status)) continue
    const daysLeft = daysBetween(today, warrantyExpiry)
    if (daysLeft >= -WARRANTY_DAYS_AFTER && daysLeft <= WARRANTY_DAYS_AHEAD) {
      alerts.push({ id, warrantyExpiry, daysLeft })
    }
  }
  return alerts.sort((a, b) => a.daysLeft - b.daysLeft)
}

export interface BackupState {
  /** The local date of the last backup, if there's been one */
  readonly lastBackupOn?: IsoDate | undefined
  readonly changesSinceBackup: number
}

export type BackupReminder =
  | { readonly reason: 'never'; readonly changes: number }
  | { readonly reason: 'changes' | 'age'; readonly daysSince: number; readonly changes: number }

/** Why a backup is due, if it is. With nothing changed since the last one, none is needed. */
export function backupReminder(
  { lastBackupOn, changesSinceBackup: changes }: BackupState,
  today: IsoDate,
): BackupReminder | undefined {
  if (changes === 0) return undefined
  if (lastBackupOn === undefined) return { reason: 'never', changes }
  const daysSince = daysBetween(lastBackupOn, today)
  if (changes >= BACKUP_DUE_CHANGES) return { reason: 'changes', daysSince, changes }
  if (daysSince >= BACKUP_DUE_DAYS) return { reason: 'age', daysSince, changes }
  return undefined
}

/** What the browser reports about its storage. Any of it can be missing. */
export interface StorageState {
  readonly usage?: number
  readonly quota?: number
  readonly persisted?: boolean
}

/** The share of storage used, if it's nearly full. */
export function storageNearlyFull({ usage, quota }: StorageState): number | undefined {
  if (usage === undefined || quota === undefined || quota <= 0) return undefined
  const usedFraction = usage / quota
  return usedFraction >= STORAGE_NEARLY_FULL ? usedFraction : undefined
}

export type Alert =
  | ({ readonly kind: 'backup' } & BackupReminder)
  | { readonly kind: 'storage-nearly-full'; readonly usedFraction: number }
  | { readonly kind: 'storage-not-persisted' }
  | ({ readonly kind: 'warranty' } & WarrantyAlert)
  | ({ readonly kind: 'duplicate-serial' } & DuplicateSerial)

export interface AlertInput {
  readonly items: readonly AlertItem[]
  readonly backup: BackupState
  readonly storage: StorageState
}

/** Every alert, with the ones that protect your data first. */
export function collectAlerts({ items, backup, storage }: AlertInput, today: IsoDate): Alert[] {
  const alerts: Alert[] = []
  const reminder = backupReminder(backup, today)
  if (reminder) alerts.push({ kind: 'backup', ...reminder })
  const usedFraction = storageNearlyFull(storage)
  if (usedFraction !== undefined) alerts.push({ kind: 'storage-nearly-full', usedFraction })
  // Browsers decide this quietly, so not being persisted yet is normal and only worth a gentle note
  if (storage.persisted === false) alerts.push({ kind: 'storage-not-persisted' })
  for (const warranty of expiringWarranties(items, today)) {
    alerts.push({ kind: 'warranty', ...warranty })
  }
  for (const duplicate of findDuplicateSerials(items)) {
    alerts.push({ kind: 'duplicate-serial', ...duplicate })
  }
  return alerts
}
