// The backup file: what goes in it, and what it's called. The format has its own version, apart
// from the database's, so a file can be checked and upgraded without touching stored data.
import type { IsoDate } from '../dates'
import type { Gear } from '../gear'
import type { CurrencyCode } from '../money'

export const BACKUP_APP = 'bodycap'
export const FORMAT_VERSION = 1

/** Larger files are refused before they're read. No real backup comes close. */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024

/** Settings worth carrying to another device. Backup bookkeeping and the theme stay behind. */
export interface BackupSettings {
  readonly lastUsedCurrency?: CurrencyCode
}

export interface BackupData {
  readonly gear: readonly Gear[]
  readonly settings: BackupSettings
}

export interface BackupInfo {
  /** The IndexedDB schema version the data was read from */
  readonly schemaVersion: number
  readonly appVersion: string
  /** ISO 8601 UTC */
  readonly exportedAt: string
}

export interface Backup extends BackupInfo {
  readonly app: typeof BACKUP_APP
  readonly formatVersion: typeof FORMAT_VERSION
  /** Shown before a restore, and checked against the data to catch a file that was cut short */
  readonly counts: { readonly gear: number }
  readonly data: BackupData
}

export function createBackup(data: BackupData, info: BackupInfo): Backup {
  return {
    app: BACKUP_APP,
    formatVersion: FORMAT_VERSION,
    ...info,
    counts: { gear: data.gear.length },
    data,
  }
}

/** Such as bodycap-backup-2026-10-05.json */
export function backupFileName(exportedOn: IsoDate): string {
  return `bodycap-backup-${exportedOn}.json`
}
