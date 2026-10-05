// The repositories, on Dexie. A gear write and the change it adds to the backup reminder's count
// run in one transaction, so they're always saved together or not at all.
import { liveQuery } from 'dexie'
import type { Gear } from '@/core/gear'
import { isCurrencyCode } from '@/core/money'
import { normaliseSerial } from '@/core/serials'
import type { BodycapDatabase, GearRecord, SettingRecord } from './db'
import {
  GearNotFoundError,
  type GearRepository,
  type Live,
  type Repositories,
  type Settings,
  type SettingsRepository,
} from './repositories'

export interface RepositoryOptions {
  /** The clock and ID source, which tests replace to get fixed values */
  readonly now?: () => Date
  readonly newId?: () => string
}

function live<T>(query: () => Promise<T>): Live<T> {
  const observable = liveQuery(query)
  return {
    subscribe(next, error) {
      const subscription = observable.subscribe({ next, error })
      return () => {
        subscription.unsubscribe()
      }
    },
  }
}

function toRecord(gear: Gear): GearRecord {
  const serialKey = normaliseSerial(gear.serialNumber ?? '')
  return serialKey === '' ? { ...gear } : { ...gear, serialKey }
}

// The serial key only serves the index, so the rest of the app never sees it
function toGear(record: GearRecord): Gear {
  const gear = { ...record }
  delete gear.serialKey
  return gear
}

const CHANGES = 'changesSinceBackup'

/** A stored count, or 0 if what's stored isn't a count */
function changeCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

async function countChange(db: BodycapDatabase): Promise<void> {
  const stored = await db.settings.get(CHANGES)
  await db.settings.put({ key: CHANGES, value: changeCount(stored?.value) + 1 })
}

// Settings are stored as loose key and value pairs, so each value is checked as it's read
function toSettings(records: readonly SettingRecord[]): Settings {
  const values = new Map(records.map(({ key, value }) => [key, value]))
  const lastBackupAt = values.get('lastBackupAt')
  const lastUsedCurrency = values.get('lastUsedCurrency')
  return {
    changesSinceBackup: changeCount(values.get(CHANGES)),
    ...(typeof lastBackupAt === 'string' ? { lastBackupAt } : {}),
    ...(typeof lastUsedCurrency === 'string' && isCurrencyCode(lastUsedCurrency)
      ? { lastUsedCurrency }
      : {}),
  }
}

export function createRepositories(
  db: BodycapDatabase,
  { now = () => new Date(), newId = () => crypto.randomUUID() }: RepositoryOptions = {},
): Repositories {
  const gear: GearRepository = {
    list: () => live(async () => (await db.gear.toArray()).map(toGear)),

    get: (id) =>
      live(async () => {
        const record = await db.gear.get(id)
        return record === undefined ? undefined : toGear(record)
      }),

    add: (fields) =>
      db.transaction('rw', db.gear, db.settings, async () => {
        const at = now().toISOString()
        const item: Gear = { ...fields, id: newId(), createdAt: at, updatedAt: at }
        await db.gear.add(toRecord(item))
        await countChange(db)
        return item
      }),

    update: (id, fields) =>
      db.transaction('rw', db.gear, db.settings, async () => {
        const existing = await db.gear.get(id)
        if (existing === undefined) throw new GearNotFoundError(id)
        const item: Gear = {
          ...fields,
          id,
          createdAt: existing.createdAt,
          updatedAt: now().toISOString(),
        }
        // put replaces the whole record, so a detail cleared in the form is really gone
        await db.gear.put(toRecord(item))
        await countChange(db)
        return item
      }),

    remove: (id) =>
      db.transaction('rw', db.gear, db.settings, async () => {
        if ((await db.gear.get(id)) === undefined) return
        await db.gear.delete(id)
        await countChange(db)
      }),
  }

  const settings: SettingsRepository = {
    get: () => live(async () => toSettings(await db.settings.toArray())),

    setLastUsedCurrency: async (currency) => {
      await db.settings.put({ key: 'lastUsedCurrency', value: currency })
    },
  }

  return { gear, settings }
}
