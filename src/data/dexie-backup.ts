// Backing up, restoring, and merging the whole database, each in one transaction. A backup and the
// reset of the change count can't drift apart, and a restore or merge changes everything or
// nothing. A .zip backup reads each full-size photo as it goes into the file, inside the same
// transaction, so the file matches the data exactly and only one image is held at a time.
import {
  backupFileName,
  createBackup,
  type BackupData,
  type BackupInfo,
  type BackupList,
} from '@/core/backup/format'
import { planMerge } from '@/core/backup/merge'
import { toIsoDate } from '@/core/dates'
import type { PhotoInfo } from '@/core/photos'
import type { BodycapDatabase, PhotoImageRecord, PhotoRecord } from './db'
import { countChange, SETTING, toGear, toPhotoInfo, toRecord, toSettings } from './records'
import { RuleError, type BackupStore, type PhotoWithBytes } from './repositories'

const LISTS: readonly BackupList[] = ['gear', 'kits', 'loans', 'maintenance', 'photos']

export interface BackupStoreOptions {
  readonly now: () => Date
  readonly appVersion: string
  readonly timeZone?: string | undefined
}

/** A photo from a backup as its two stored records: its details with its thumbnail, and its image */
function toStored(info: PhotoInfo, { thumbnail, image }: PhotoWithBytes) {
  const record: PhotoRecord = { ...toPhotoInfo(info), thumbnail }
  const full: PhotoImageRecord = { id: info.id, image }
  return { record, full }
}

export function createBackupStore(
  db: BodycapDatabase,
  { now, appVersion, timeZone }: BackupStoreOptions,
): BackupStore {
  const everything = [
    db.gear,
    db.kits,
    db.loans,
    db.maintenance,
    db.photos,
    db.photoImages,
    db.settings,
  ]

  /** Everything a backup holds, as it's stored now, and the photos' records. Call it inside a transaction. */
  const readAll = async () => {
    const photos = await db.photos.toArray()
    const { lastUsedCurrency } = toSettings(await db.settings.toArray())
    const data: BackupData = {
      gear: (await db.gear.toArray()).map(toGear),
      kits: await db.kits.toArray(),
      loans: await db.loans.toArray(),
      maintenance: await db.maintenance.toArray(),
      photos: photos.map(toPhotoInfo),
      settings: lastUsedCurrency === undefined ? {} : { lastUsedCurrency },
    }
    return { data, photos }
  }

  const infoAt = (at: Date): BackupInfo => ({
    schemaVersion: db.verno,
    appVersion,
    exportedAt: at.toISOString(),
  })

  /** Marks the data as backed up when `exportedAt` says. Call it inside a transaction. */
  const recordBackup = (exportedAt: string) =>
    db.settings.bulkPut([
      { key: SETTING.lastBackupAt, value: exportedAt },
      { key: SETTING.changesSinceBackup, value: 0 },
    ])

  /** A photo's full-size image. Call it inside a transaction, where every photo has one. */
  const readImage = async (id: string) => {
    const stored = await db.photoImages.get(id)
    if (stored === undefined) throw new Error(`No image for photo ${id}`)
    return stored.image
  }

  return {
    create: () =>
      db.transaction('rw', everything, async () => {
        const at = now()
        // A .json backup leaves photos out, so it stays small enough to read
        const { data } = await readAll()
        const backup = createBackup({ ...data, photos: [] }, infoAt(at))
        await recordBackup(backup.exportedAt)
        // Indented, so anyone who opens the file can read it
        const text = JSON.stringify(backup, null, 2)
        return { name: backupFileName(toIsoDate(at, timeZone)), text }
      }),

    createZip: async () => {
      // Loaded only when needed, and before the transaction, which can only wait on the database
      const { zipBackup } = await import('./backup-zip')
      // Changes made while the file is being made wait for this transaction, so they count after it
      return db.transaction('rw', everything, async () => {
        const at = now()
        const { data, photos } = await readAll()
        const backup = createBackup(data, infoAt(at))
        const blob = await zipBackup(JSON.stringify(backup, null, 2), photos, readImage, at)
        await recordBackup(backup.exportedAt)
        return { name: backupFileName(toIsoDate(at, timeZone), 'zip'), blob }
      })
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
          db.photoImages.clear(),
        ])
        await db.gear.bulkAdd(gear.map(toRecord))
        await db.kits.bulkAdd(kits)
        await db.loans.bulkAdd(loans)
        await db.maintenance.bulkAdd(maintenance)
        const photos = backup.storedPhotos.map((photo) => toStored(photo, photo))
        await db.photos.bulkAdd(photos.map(({ record }) => record))
        await db.photoImages.bulkAdd(photos.map(({ full }) => full))
        // The data now matches the file, so it counts as backed up when the file was made
        await recordBackup(backup.exportedAt)
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
        const bytes = new Map(backup.storedPhotos.map((photo) => [photo.id, photo]))
        // The plan may have settled a photo's cover, so its details come from the plan
        const photos = writes.photos.map((info) => {
          const stored = bytes.get(info.id)
          // readBackupFile pairs every photo a backup lists with its bytes, so this is a bug
          if (stored === undefined) throw new Error(`No bytes for photo ${info.id}`)
          return toStored(info, stored)
        })
        await db.gear.bulkPut(writes.gear.map(toRecord))
        await db.kits.bulkPut(writes.kits)
        await db.loans.bulkPut(writes.loans)
        await db.maintenance.bulkPut(writes.maintenance)
        await db.photos.bulkPut(photos.map(({ record }) => record))
        await db.photoImages.bulkPut(photos.map(({ full }) => full))
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
