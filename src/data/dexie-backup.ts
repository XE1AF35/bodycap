// Backing up and restoring the whole database, each in one transaction. A backup and the reset of
// the change count can't drift apart, and a restore replaces everything or nothing.
import { backupFileName, createBackup, type Backup } from '@/core/backup/format'
import { toIsoDate } from '@/core/dates'
import type { BodycapDatabase } from './db'
import { SETTING, toGear, toRecord, toSettings } from './records'
import type { BackupStore } from './repositories'

export interface BackupStoreOptions {
  readonly now: () => Date
  readonly appVersion: string
  readonly timeZone?: string | undefined
}

export function createBackupStore(
  db: BodycapDatabase,
  { now, appVersion, timeZone }: BackupStoreOptions,
): BackupStore {
  const everything = [db.gear, db.kits, db.loans, db.maintenance, db.settings]
  return {
    create: () =>
      db.transaction('rw', everything, async () => {
        const at = now()
        const exportedAt = at.toISOString()
        const { lastUsedCurrency } = toSettings(await db.settings.toArray())
        const backup = createBackup(
          {
            gear: (await db.gear.toArray()).map(toGear),
            kits: await db.kits.toArray(),
            loans: await db.loans.toArray(),
            maintenance: await db.maintenance.toArray(),
            settings: lastUsedCurrency === undefined ? {} : { lastUsedCurrency },
          },
          { schemaVersion: db.verno, appVersion, exportedAt },
        )
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
  }
}
