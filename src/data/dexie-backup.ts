// Backing up and restoring the whole database, each in one transaction. A backup and the reset of
// the change count can't drift apart, and a restore replaces everything or nothing.
//
// Database version 1 has nowhere to keep kits, loans, or maintenance, so backups hold none, and a
// backup that brings any is refused whole rather than restored without them. Version 2 adds them.
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
  return {
    create: () =>
      db.transaction('rw', db.gear, db.settings, async () => {
        const at = now()
        const exportedAt = at.toISOString()
        const gear = (await db.gear.toArray()).map(toGear)
        const { lastUsedCurrency } = toSettings(await db.settings.toArray())
        const backup = createBackup(
          {
            gear,
            kits: [],
            loans: [],
            maintenance: [],
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
      db.transaction('rw', db.gear, db.settings, async () => {
        const { kits, loans, maintenance } = backup.data
        if (kits.length + loans.length + maintenance.length > 0) {
          throw new Error("This database can't keep kits, loans, or maintenance yet")
        }
        await db.gear.clear()
        await db.gear.bulkAdd(backup.data.gear.map(toRecord))
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
