// Backing up, restoring, and merging the whole database. A .json backup and the reset of the change
// count share one transaction. A .zip backup reads everything in one transaction and records itself
// in another once its file is made, since a transaction can't wait while photos are read. A restore
// or merge changes everything or nothing.
import {
  backupFileName,
  createBackup,
  type BackupData,
  type BackupInfo,
  type BackupList,
} from '@/core/backup/format'
import { planMerge } from '@/core/backup/merge'
import { toIsoDate } from '@/core/dates'
import type { Photo, PhotoInfo } from '@/core/photos'
import { zipBackup } from './backup-zip'
import type { BodycapDatabase } from './db'
import { countChange, SETTING, toGear, toPhotoInfo, toRecord, toSettings } from './records'
import { RuleError, type BackupStore } from './repositories'

const LISTS: readonly BackupList[] = ['gear', 'kits', 'loans', 'maintenance', 'photos']

export interface BackupStoreOptions {
  readonly now: () => Date
  readonly appVersion: string
  readonly timeZone?: string | undefined
}

/** A photo from a merge plan, with the images its backup brought for it */
function withImages(info: PhotoInfo, stored: ReadonlyMap<string, Photo>): Photo {
  const photo = stored.get(info.id)
  // readBackupFile pairs every photo a backup lists with its images, so this is a bug
  if (photo === undefined) throw new Error(`No images for photo ${info.id}`)
  return { ...info, image: photo.image, thumbnail: photo.thumbnail }
}

export function createBackupStore(
  db: BodycapDatabase,
  { now, appVersion, timeZone }: BackupStoreOptions,
): BackupStore {
  const everything = [db.gear, db.kits, db.loans, db.maintenance, db.photos, db.settings]

  /** Everything a backup holds, as it's stored now, with the photos themselves. Call it inside a transaction. */
  const readAll = async () => {
    const photos = await db.photos.toArray()
    const { lastUsedCurrency, changesSinceBackup } = toSettings(await db.settings.toArray())
    const data: BackupData = {
      gear: (await db.gear.toArray()).map(toGear),
      kits: await db.kits.toArray(),
      loans: await db.loans.toArray(),
      maintenance: await db.maintenance.toArray(),
      photos: photos.map(toPhotoInfo),
      settings: lastUsedCurrency === undefined ? {} : { lastUsedCurrency },
    }
    return { data, photos, changesSinceBackup }
  }

  const infoAt = (at: Date): BackupInfo => ({
    schemaVersion: db.verno,
    appVersion,
    exportedAt: at.toISOString(),
  })

  /** Marks the data as backed up at `exportedAt`, with `changes` made since. Call it inside a transaction. */
  const recordBackup = (exportedAt: string, changes: number) =>
    db.settings.bulkPut([
      { key: SETTING.lastBackupAt, value: exportedAt },
      { key: SETTING.changesSinceBackup, value: changes },
    ])

  return {
    create: () =>
      db.transaction('rw', everything, async () => {
        const at = now()
        // A .json backup leaves photos out, so it stays small enough to read
        const { data } = await readAll()
        const backup = createBackup({ ...data, photos: [] }, infoAt(at))
        await recordBackup(backup.exportedAt, 0)
        // Indented, so anyone who opens the file can read it
        const text = JSON.stringify(backup, null, 2)
        return { name: backupFileName(toIsoDate(at, timeZone)), text }
      }),

    createZip: async () => {
      const at = now()
      const snapshot = await db.transaction('r', everything, readAll)
      const backup = createBackup(snapshot.data, infoAt(at))
      const blob = await zipBackup(JSON.stringify(backup, null, 2), snapshot.photos, at)
      // Changes saved while the file was being made aren't in it, so they still count
      await db.transaction('rw', db.settings, async () => {
        const { changesSinceBackup } = toSettings(await db.settings.toArray())
        await recordBackup(
          backup.exportedAt,
          Math.max(0, changesSinceBackup - snapshot.changesSinceBackup),
        )
      })
      return { name: backupFileName(toIsoDate(at, timeZone), 'zip'), blob }
    },

    restore: (backup) =>
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
        await db.photos.bulkAdd(backup.storedPhotos)
        // The data now matches the file, so it counts as backed up when the file was made
        await recordBackup(backup.exportedAt, 0)
        const { lastUsedCurrency } = backup.data.settings
        if (lastUsedCurrency === undefined) {
          await db.settings.delete(SETTING.lastUsedCurrency)
        } else {
          await db.settings.put({ key: SETTING.lastUsedCurrency, value: lastUsedCurrency })
        }
      }),

    merge: (backup) =>
      db.transaction('rw', everything, async () => {
        const plan = planMerge((await readAll()).data, backup.data)
        if (!plan.ok) throw new RuleError(plan.error)
        const { writes, added, updated, coverChanges, settings } = plan.value
        const stored = new Map(backup.storedPhotos.map((photo) => [photo.id, photo]))
        await db.gear.bulkPut(writes.gear.map(toRecord))
        await db.kits.bulkPut(writes.kits)
        await db.loans.bulkPut(writes.loans)
        await db.maintenance.bulkPut(writes.maintenance)
        await db.photos.bulkPut(writes.photos.map((info) => withImages(info, stored)))
        await db.photos.bulkUpdate(
          coverChanges.map(({ id, isCover }) => ({ key: id, changes: { isCover } })),
        )
        if (settings.lastUsedCurrency !== undefined) {
          await db.settings.put({ key: SETTING.lastUsedCurrency, value: settings.lastUsedCurrency })
        }
        // The merged data matches no single backup, so the last backup stays as it was
        await countChange(
          db,
          LISTS.reduce((sum, list) => sum + added[list] + updated[list], coverChanges.length),
        )
        return { added, updated }
      }),
  }
}
