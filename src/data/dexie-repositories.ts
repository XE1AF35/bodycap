// The repositories, on Dexie. A gear write and the change it adds to the backup reminder's count
// run in one transaction, so they're always saved together or not at all.
import { liveQuery } from 'dexie'
import type { Gear } from '@/core/gear'
import type { BodycapDatabase } from './db'
import { createBackupStore } from './dexie-backup'
import { countChange, SETTING, toGear, toRecord, toSettings } from './records'
import {
  GearNotFoundError,
  type GearRepository,
  type Live,
  type Repositories,
  type SettingsRepository,
} from './repositories'

export interface RepositoryOptions {
  /** The clock and ID source, which tests replace to get fixed values */
  readonly now?: () => Date
  readonly newId?: () => string
  /** Recorded in backups. The build sets it from package.json. */
  readonly appVersion?: string
  /** For the date in a backup's file name. The browser's own time zone by default. */
  readonly timeZone?: string
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

export function createRepositories(
  db: BodycapDatabase,
  {
    now = () => new Date(),
    newId = () => crypto.randomUUID(),
    appVersion = __APP_VERSION__,
    timeZone,
  }: RepositoryOptions = {},
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
      await db.settings.put({ key: SETTING.lastUsedCurrency, value: currency })
    },
  }

  const backup = createBackupStore(db, { now, appVersion, timeZone })

  return { gear, settings, backup }
}
