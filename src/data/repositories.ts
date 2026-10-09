// What the UI sees of storage. Components only use these interfaces, so another store, or sync,
// could replace Dexie later without touching them.
import type { Backup } from '@/core/backup/format'
import type { MergePlan } from '@/core/backup/merge'
import type { Gear, GearFields } from '@/core/gear'
import type { Kit, KitDetails, KitFields } from '@/core/kits'
import type { Loan, LoanDetails } from '@/core/loans'
import type { MaintenanceDetails, MaintenanceRecord } from '@/core/maintenance'
import type { CurrencyCode } from '@/core/money'
import type { NewPhoto, Photo } from '@/core/photos'

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
  /** Saves several new items at once: all of them, or none if any can't be saved */
  addAll(list: readonly GearFields[]): Promise<readonly Gear[]>
  /** Replaces an item's details. Rejects with GearNotFoundError if it's gone. */
  update(id: string, fields: GearFields): Promise<Gear>
  /**
   * Deletes an item, with its loans, maintenance, and photos, and takes it out of every kit, all at
   * once. Deleting one that's already gone does nothing.
   */
  remove(id: string): Promise<void>
}

export interface KitRepository {
  /** Every kit, in no particular order */
  list(): Live<readonly Kit[]>
  get(id: string): Live<Kit | undefined>
  /** The kits an item is in */
  withGear(gearId: string): Live<readonly Kit[]>
  /** Saves a new kit: empty, with the checklist off */
  add(details: KitDetails): Promise<Kit>
  /**
   * Changes a kit by applying a kit rule, such as addToKit, to the kit as saved at that moment, so
   * changes made close together never undo each other. Rejects with RecordNotFoundError if the kit
   * is gone, or GearNotFoundError if the change adds gear that's gone.
   */
  update(id: string, change: (kit: Kit) => KitFields): Promise<Kit>
  /** Deletes a kit, but none of its gear. Deleting one that's already gone does nothing. */
  remove(id: string): Promise<void>
}

export interface LoanRepository {
  /** Every loan, returned or not, in no particular order */
  list(): Live<readonly Loan[]>
  forGear(gearId: string): Live<readonly Loan[]>
  /**
   * Lends an item: saves the loan and marks the item lent out, together. Rejects with
   * GearNotFoundError if the item is gone, or RuleError if it can't be lent now.
   */
  lend(gearId: string, details: LoanDetails): Promise<Loan>
  /**
   * Records a loan's return on the date typed, and marks the item owned again, together. An item
   * that has moved on meanwhile, such as one lost while lent, keeps its status. Rejects with
   * RecordNotFoundError if the loan is gone, or RuleError if the date doesn't fit.
   */
  giveBack(id: string, returnedOn: string): Promise<Loan>
  /** Replaces a loan's details, such as its due date, keeping its item and return */
  update(id: string, details: LoanDetails): Promise<Loan>
}

export interface MaintenanceRepository {
  forGear(gearId: string): Live<readonly MaintenanceRecord[]>
  /** Saves a record for an item. Rejects with GearNotFoundError if the item is gone. */
  add(gearId: string, details: MaintenanceDetails): Promise<MaintenanceRecord>
  /** Replaces a record's details, keeping its item */
  update(id: string, details: MaintenanceDetails): Promise<MaintenanceRecord>
  remove(id: string): Promise<void>
}

export interface PhotoRepository {
  /** An item's photos, oldest first */
  forGear(gearId: string): Live<readonly Photo[]>
  /** Each item's cover photo, by the item's ID, for lists. Items with no photos aren't there. */
  covers(): Live<ReadonlyMap<string, Photo>>
  /**
   * Saves photos for an item, all of them or none, in the order given. The first becomes the cover
   * if the item has none. Rejects with GearNotFoundError if the item is gone, or RuleError if they
   * won't fit on it or one can't be kept.
   */
  add(gearId: string, photos: readonly NewPhoto[]): Promise<readonly Photo[]>
  /** Makes a photo its item's cover. Rejects with RecordNotFoundError if it's gone. */
  setCover(id: string): Promise<void>
  /**
   * Deletes a photo. If it was the cover, the oldest photo left takes over. Deleting one that's
   * already gone does nothing.
   */
  remove(id: string): Promise<void>
}

export interface Settings {
  /** ISO 8601 UTC, once there's been a backup */
  readonly lastBackupAt?: string
  readonly changesSinceBackup: number
  readonly lastUsedCurrency?: CurrencyCode
  /** Kept on this device only. New amounts start in it, rather than the currency used last. */
  readonly defaultCurrency?: CurrencyCode
  /** Kept on this device only. Days after a backup before the reminder, once it's been chosen. */
  readonly backupReminderDays?: number
}

export interface SettingsRepository {
  get(): Live<Settings>
  setLastUsedCurrency(currency: CurrencyCode): Promise<void>
  /** Undefined goes back to starting amounts in the currency used last */
  setDefaultCurrency(currency: CurrencyCode | undefined): Promise<void>
  setBackupReminderDays(days: number): Promise<void>
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
  /**
   * Adds a backup's contents to what's here, keeping whichever copy of each record changed last,
   * in one go: if anything fails, nothing changes. Rejects with RuleError if the two can't be
   * merged. Check the file with readBackupFile first.
   */
  merge(backup: Backup): Promise<MergeSummary>
}

/** How many records of each kind a merge added, and how many it replaced with newer copies */
export type MergeSummary = Pick<MergePlan, 'added' | 'updated'>

export interface Repositories {
  readonly gear: GearRepository
  readonly kits: KitRepository
  readonly loans: LoanRepository
  readonly maintenance: MaintenanceRepository
  readonly photos: PhotoRepository
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

/** A kit, loan, maintenance record, or photo was deleted, perhaps in another tab, before a change */
export class RecordNotFoundError extends Error {
  override readonly name = 'RecordNotFoundError'
  readonly kind: 'kit' | 'loan' | 'maintenance' | 'photo'
  readonly id: string

  constructor(kind: RecordNotFoundError['kind'], id: string) {
    super(`No ${kind} with ID ${id}`)
    this.kind = kind
    this.id = id
  }
}

/**
 * A change the rules don't allow, usually because something changed in another tab, such as an
 * item sold there before it was lent here. The message is written for the person.
 */
export class RuleError extends Error {
  override readonly name = 'RuleError'
}
