// Upgrades older backup files to the current format, one version at a time, before they're checked.
// Each step is a pure function tested on its own, so a backup from any earlier version restores.
import { FORMAT_VERSION } from './format'

/** Turns a backup in one format version into the next one up */
export type BackupMigration = (file: Readonly<Record<string, unknown>>) => Record<string, unknown>

type Migrations = Readonly<Partial<Record<number, BackupMigration>>>

/** Step n upgrades format n to n + 1. Format 1 is the first, so there are none yet. */
export const BACKUP_MIGRATIONS: Migrations = {}

/** Upgrades a file in format `from` to format `to`, setting its formatVersion as it goes. */
export function migrateBackup(
  file: Readonly<Record<string, unknown>>,
  from: number,
  to: number = FORMAT_VERSION,
  migrations: Migrations = BACKUP_MIGRATIONS,
): Readonly<Record<string, unknown>> {
  let current = file
  for (let version = from; version < to; version += 1) {
    const step = migrations[version]
    if (step === undefined) {
      throw new Error(`No backup migration from format ${String(version)}`)
    }
    current = { ...step(current), formatVersion: version + 1 }
  }
  return current
}
