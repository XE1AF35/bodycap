// The IndexedDB database, through Dexie. A released version is never edited: a change to what's
// stored adds a new version with a tested upgrade, and bumps the backup format.
import Dexie, { type DexieOptions, type EntityTable } from 'dexie'
import type { Gear } from '@/core/gear'

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

  /** Options let tests pass in fake-indexeddb */
  constructor(options?: DexieOptions) {
    super('bodycap', options)
    this.version(1).stores({
      gear: 'id, category, status, mount, serialKey, warrantyExpiry, updatedAt',
      settings: 'key',
    })
  }
}
