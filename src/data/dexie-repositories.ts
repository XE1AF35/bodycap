// The repositories, on Dexie. Each write and the change it adds to the backup reminder's count run
// in one transaction, so they're always saved together or not at all.
import { toIsoDate } from '@/core/dates'
import type { Gear } from '@/core/gear'
import { removeFromKit } from '@/core/kits'
import type { BodycapDatabase } from './db'
import { createBackupStore } from './dexie-backup'
import { createKitRepository } from './dexie-kits'
import { createLoanRepository } from './dexie-loans'
import { createMaintenanceRepository } from './dexie-maintenance'
import { live } from './live'
import { countChange, SETTING, toGear, toRecord, toSettings } from './records'
import {
  GearNotFoundError,
  type GearRepository,
  type Repositories,
  type SettingsRepository,
} from './repositories'

export interface RepositoryOptions {
  /** The clock and ID source, which tests replace to get fixed values */
  readonly now?: () => Date
  readonly newId?: () => string
  /** Recorded in backups. The build sets it from package.json. */
  readonly appVersion?: string
  /** For today's date and the date in a backup's file name. The browser's own by default. */
  readonly timeZone?: string
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

    addAll: (list) =>
      db.transaction('rw', db.gear, db.settings, async () => {
        const at = now().toISOString()
        const items = list.map((fields): Gear => ({
          ...fields,
          id: newId(),
          createdAt: at,
          updatedAt: at,
        }))
        await db.gear.bulkAdd(items.map(toRecord))
        await countChange(db, items.length)
        return items
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

    // Nothing may point at gear that's gone, or a backup of what's left would be refused
    remove: (id) =>
      db.transaction('rw', [db.gear, db.kits, db.loans, db.maintenance, db.settings], async () => {
        if ((await db.gear.get(id)) === undefined) return
        await db.gear.delete(id)
        await db.loans.where('gearId').equals(id).delete()
        await db.maintenance.where('gearId').equals(id).delete()
        const at = now().toISOString()
        const kits = await db.kits.where('gearIds').equals(id).distinct().toArray()
        await db.kits.bulkPut(kits.map((kit) => ({ ...removeFromKit(kit, id), updatedAt: at })))
        await countChange(db)
      }),
  }

  const settings: SettingsRepository = {
    get: () => live(async () => toSettings(await db.settings.toArray())),

    setLastUsedCurrency: async (currency) => {
      await db.settings.put({ key: SETTING.lastUsedCurrency, value: currency })
    },

    // Preferences for this device, so neither counts as a change to back up
    setDefaultCurrency: async (currency) => {
      if (currency === undefined) await db.settings.delete(SETTING.defaultCurrency)
      else await db.settings.put({ key: SETTING.defaultCurrency, value: currency })
    },

    setBackupReminderDays: async (days) => {
      await db.settings.put({ key: SETTING.backupReminderDays, value: days })
    },
  }

  const today = () => toIsoDate(now(), timeZone)
  const kits = createKitRepository(db, { now, newId })
  const loans = createLoanRepository(db, { now, newId, today })
  const maintenance = createMaintenanceRepository(db, { now, newId })
  const backup = createBackupStore(db, { now, appVersion, timeZone })

  return { gear, kits, loans, maintenance, settings, backup }
}
