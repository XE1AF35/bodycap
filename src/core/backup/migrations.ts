// Upgrades older backup files to the current format, one version at a time, before they're checked.
// Each step is a pure function tested on its own, so a backup from any earlier version restores.
import { FORMAT_VERSION } from './format'

/** Turns a backup in one format version into the next one up */
export type BackupMigration = (file: Readonly<Record<string, unknown>>) => Record<string, unknown>

type Migrations = Readonly<Partial<Record<number, BackupMigration>>>

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Format 1 had only gear and settings. Format 2 adds kits, loans, and maintenance, which a format 1
 * file has none of, and optional lens optics, which its gear simply doesn't have. A file whose data
 * or counts aren't objects is left as it is, for the checks to refuse as damaged.
 */
function addKitsLoansAndMaintenance(file: Readonly<Record<string, unknown>>) {
  const { data, counts } = file
  if (!isObject(data) || !isObject(counts)) return { ...file }
  return {
    ...file,
    counts: { ...counts, kits: 0, loans: 0, maintenance: 0 },
    data: { ...data, kits: [], loans: [], maintenance: [] },
  }
}

/** Format 3 adds photos, which a format 2 file has none of */
function addPhotos(file: Readonly<Record<string, unknown>>) {
  const { data, counts } = file
  if (!isObject(data) || !isObject(counts)) return { ...file }
  return { ...file, counts: { ...counts, photos: 0 }, data: { ...data, photos: [] } }
}

/**
 * Format 4 adds optional gear fields, so a format 3 file is already valid as it is. The step still
 * exists so an older Bodycap refuses a format 4 file, rather than dropping the fields it can't read.
 */
function addGearMeasurements(file: Readonly<Record<string, unknown>>) {
  return { ...file }
}

/** Format 5 adds the shoots log, which a format 4 file has none of */
function addShoots(file: Readonly<Record<string, unknown>>) {
  const { data, counts } = file
  if (!isObject(data) || !isObject(counts)) return { ...file }
  return { ...file, counts: { ...counts, shoots: 0 }, data: { ...data, shoots: [] } }
}

/** Step n upgrades format n to n + 1 */
export const BACKUP_MIGRATIONS: Migrations = {
  1: addKitsLoansAndMaintenance,
  2: addPhotos,
  3: addGearMeasurements,
  4: addShoots,
}

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
