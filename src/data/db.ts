// The IndexedDB database, through Dexie. A released version is never edited: a change to what's
// stored adds a new version with a tested upgrade, and bumps the backup format.
import Dexie, { type DexieOptions, type EntityTable } from 'dexie'
import type { Gear } from '@/core/gear'
import type { Kit } from '@/core/kits'
import type { Loan } from '@/core/loans'
import type { MaintenanceRecord } from '@/core/maintenance'
import type { PhotoInfo } from '@/core/photos'

/** A gear item as stored: the item, plus its normalised serial for the index */
export interface GearRecord extends Gear {
  serialKey?: string
}

/**
 * A photo as stored: its details and its thumbnail. Images are kept as bytes rather than Blobs,
 * since Safari won't store a Blob in a private window.
 */
export interface PhotoRecord extends PhotoInfo {
  readonly thumbnail: ArrayBuffer
}

/** A photo's full-size image, kept apart so lists and the gallery read only thumbnails */
export interface PhotoImageRecord {
  readonly id: string
  readonly image: ArrayBuffer
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
  declare photos: EntityTable<PhotoRecord, 'id'>
  declare photoImages: EntityTable<PhotoImageRecord, 'id'>

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
    // M3 adds photos: their details and thumbnails, and their full-size images apart, keyed by the
    // same ID. Nothing else changes, so there's nothing to upgrade.
    this.version(3).stores({
      photos: 'id, gearId',
      photoImages: 'id',
    })
    // M3.5 adds weight, filter thread, and catalogue ID to gear, all optional and unindexed, so
    // nothing is upgraded. The new version still closes tabs running an older build, which would
    // otherwise save items without the new fields.
    this.version(4).stores({})
  }
}
