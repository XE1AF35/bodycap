// Backing up, restoring, and merging the whole database, each in one transaction. A backup and the
// reset of the change count can't drift apart, and a restore or merge changes everything or
// nothing.
import {
  backupFileName,
  createBackup,
  type Backup,
  type BackupData,
  type BackupList,
} from '@/core/backup/format'
import { planMerge } from '@/core/backup/merge'
import { toIsoDate } from '@/core/dates'
import type { BodycapDatabase } from './db'
import { countChange, SETTING, toGear, toRecord, toSettings } from './records'
import { RuleError, type BackupStore } from './repositories'

const LISTS: readonly BackupList[] = ['gear', 'kits', 'loans', 'maintenance', 'photos']

export interface BackupStoreOptions {
  readonly now: () => Date
  readonly appVersion: string
  readonly timeZone?: string | undefined
}

export function createBackupStore(
  db: BodycapDatabase,
  { now, appVersion, timeZone }: BackupStoreOptions,
): BackupStore {
  const everything = [db.gear, db.kits, db.loans, db.maintenance, db.photos, db.settings]

  /** Everything a backup holds, as it's stored now. Call it inside a transaction. */
  const readAll = async (): Promise<BackupData> => {
    const { lastUsedCurrency } = toSettings(await db.settings.toArray())
    return {
      gear: (await db.gear.toArray()).map(toGear),
      kits: await db.kits.toArray(),
      loans: await db.loans.toArray(),
      maintenance: await db.maintenance.toArray(),
      // A .json backup leaves photos out
      photos: [],
      settings: lastUsedCurrency === undefined ? {} : { lastUsedCurrency },
    }
  }

  return {
    create: () =>
      db.transaction('rw', everything, async () => {
        const at = now()
        const exportedAt = at.toISOString()
        const backup = createBackup(await readAll(), {
          schemaVersion: db.verno,
          appVersion,
          exportedAt,
        })
        await db.settings.bulkPut([
          { key: SETTING.lastBackupAt, value: exportedAt },
          { key: SETTING.changesSinceBackup, value: 0 },
        ])
        // Indented, so anyone who opens the file can read it
        const text = JSON.stringify(backup, null, 2)
        return { name: backupFileName(toIsoDate(at, timeZone)), text }
      }),

    restore: (backup: Backup) =>
      db.transaction('rw', everything, async () => {
        const { gear, kits, loans, maintenance } = backup.data
        await Promise.all([
          db.gear.clear(),
          db.kits.clear(),
          db.loans.clear(),
          db.maintenance.clear(),
          db.photos.clear(),
        ])
        await db.gear.bulkAdd(gear.map(toRecord))
        await db.kits.bulkAdd(kits)
        await db.loans.bulkAdd(loans)
        await db.maintenance.bulkAdd(maintenance)
        // The data now matches the file, so it counts as backed up when the file was made
        await db.settings.bulkPut([
          { key: SETTING.lastBackupAt, value: backup.exportedAt },
          { key: SETTING.changesSinceBackup, value: 0 },
        ])
        const { lastUsedCurrency } = backup.data.settings
        if (lastUsedCurrency === undefined) {
          await db.settings.delete(SETTING.lastUsedCurrency)
        } else {
          await db.settings.put({ key: SETTING.lastUsedCurrency, value: lastUsedCurrency })
        }
      }),

    merge: (backup: Backup) =>
      db.transaction('rw', everything, async () => {
        const plan = planMerge(await readAll(), backup.data)
        if (!plan.ok) throw new RuleError(plan.error)
        const { writes, added, updated, settings } = plan.value
        await db.gear.bulkPut(writes.gear.map(toRecord))
        await db.kits.bulkPut(writes.kits)
        await db.loans.bulkPut(writes.loans)
        await db.maintenance.bulkPut(writes.maintenance)
        if (settings.lastUsedCurrency !== undefined) {
          await db.settings.put({ key: SETTING.lastUsedCurrency, value: settings.lastUsedCurrency })
        }
        // The merged data matches no single backup, so the last backup stays as it was
        await countChange(
          db,
          LISTS.reduce((sum, list) => sum + added[list] + updated[list], 0),
        )
        return { added, updated }
      }),
  }
}
