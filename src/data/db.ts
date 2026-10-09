// The IndexedDB database, through Dexie. A released version is never edited: a change to what's
// stored adds a new version with a tested upgrade, and bumps the backup format.
import Dexie, { type DexieOptions, type EntityTable } from 'dexie'
import type { Gear } from '@/core/gear'
import type { Kit } from '@/core/kits'
import type { Loan } from '@/core/loans'
import type { MaintenanceRecord } from '@/core/maintenance'
import type { Photo } from '@/core/photos'

/** A gear item as stored: the item, plus its normalised serial for the index */
export interface GearRecord extends Gear {
  serialKey?: string
}

/** One setting, such as the number of changes since the last backup */
export interface SettingRecord {
  readonly key: string
  readonly value: unknown
}

export class BodycapDatabase extends Dexie {
  // Declared rather than defined, so the class fields don't overwrite the tables Dexie sets up
  declare gear: EntityTable<GearRecord, 'id'>
  declare settings: EntityTable<SettingRecord, 'key'>
  declare kits: EntityTable<Kit, 'id'>
  declare loans: EntityTable<Loan, 'id'>
  declare maintenance: EntityTable<MaintenanceRecord, 'id'>
  declare photos: EntityTable<Photo, 'id'>

  /** Options let tests pass in fake-indexeddb */
  constructor(options?: DexieOptions) {
    super('bodycap', options)
    // Released with M1
    this.version(1).stores({
      gear: 'id, category, status, mount, serialKey, warrantyExpiry, updatedAt',
      settings: 'key',
    })
    // M2 adds three tables and leaves gear and settings as they were. Gear's new lens optics are
    // optional and unindexed, so existing items need no upgrade.
    this.version(2).stores({
      // *gearIds indexes each item in a kit, to find the kits an item is in
      kits: 'id, name, *gearIds',
      loans: 'id, gearId, dueDate, [gearId+dateOut]',
      maintenance: 'id, gearId, date, [gearId+date]',
    })
    // M3 adds photos, each holding its image and thumbnail as Blobs. Nothing else changes, so
    // there's nothing to upgrade.
    this.version(3).stores({
      photos: 'id, gearId',
    })
  }
}
