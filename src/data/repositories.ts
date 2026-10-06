// What the UI sees of storage. Components only use these interfaces, so another store, or sync,
// could replace Dexie later without touching them.
import type { Backup } from '@/core/backup/format'
import type { Gear, GearFields } from '@/core/gear'
import type { CurrencyCode } from '@/core/money'

/** A query that gives fresh results whenever its data changes, until unsubscribed */
export interface Live<T> {
  subscribe(next: (value: T) => void, error: (error: unknown) => void): () => void
}

export interface GearRepository {
  /** Every item, in no particular order, since the list sorts them itself */
  list(): Live<readonly Gear[]>
  get(id: string): Live<Gear | undefined>
  /** Saves a new item, giving it an ID and timestamps */
  add(fields: GearFields): Promise<Gear>
  /** Replaces an item's details. Rejects with GearNotFoundError if it's gone. */
  update(id: string, fields: GearFields): Promise<Gear>
  /** Deletes an item. Deleting one that's already gone does nothing. */
  remove(id: string): Promise<void>
}

export interface Settings {
  /** ISO 8601 UTC, once there's been a backup */
  readonly lastBackupAt?: string
  readonly changesSinceBackup: number
  readonly lastUsedCurrency?: CurrencyCode
}

export interface SettingsRepository {
  get(): Live<Settings>
  setLastUsedCurrency(currency: CurrencyCode): Promise<void>
}

/** A backup ready to download */
export interface BackupFile {
  /** Such as bodycap-backup-2026-10-05.json */
  readonly name: string
  readonly text: string
}

export interface BackupStore {
  /** Backs up everything, recording it as the latest backup and counting changes from zero */
  create(): Promise<BackupFile>
  /**
   * Replaces everything with a backup's contents, in one go: if anything fails, nothing changes.
   * Check the file with readBackupFile first.
   */
  restore(backup: Backup): Promise<void>
}

export interface Repositories {
  readonly gear: GearRepository
  readonly settings: SettingsRepository
  readonly backup: BackupStore
}

/** The item was deleted, perhaps in another tab, before a change to it could be saved */
export class GearNotFoundError extends Error {
  override readonly name = 'GearNotFoundError'
  readonly id: string

  constructor(id: string) {
    super(`No gear with ID ${id}`)
    this.id = id
  }
}
