// The photo repository, on Dexie. A photo belongs to an item that exists, every change leaves each
// item with exactly one cover, and each change is counted for the backup reminder in the same
// transaction. A photo's details and thumbnail live in one table and its full-size image in
// another, written and deleted together.
import { coverChanges, isStorablePhoto, photoCountProblem, sortPhotos } from '@/core/photos'
import type { BodycapDatabase, PhotoRecord } from './db'
import { live } from './live'
import { countChange, toPhoto } from './records'
import {
  GearNotFoundError,
  RecordNotFoundError,
  RuleError,
  type PhotoRepository,
} from './repositories'

export interface PhotoRepositoryOptions {
  readonly now: () => Date
  readonly newId: () => string
}

export function createPhotoRepository(
  db: BodycapDatabase,
  { now, newId }: PhotoRepositoryOptions,
): PhotoRepository {
  const itemPhotos = (gearId: string) => db.photos.where('gearId').equals(gearId).toArray()

  /** Saves cover changes worked out by the rules. Call it inside the change's transaction. */
  const saveCovers = async (changed: readonly PhotoRecord[]) => {
    const updatedAt = now().toISOString()
    await db.photos.bulkUpdate(
      changed.map(({ id, isCover }) => ({ key: id, changes: { isCover, updatedAt } })),
    )
  }

  return {
    forGear: (gearId) => live(async () => sortPhotos(await itemPhotos(gearId)).map(toPhoto)),

    // Covers can't be indexed, since IndexedDB keys can't be true or false, so every photo's
    // details and thumbnail are read, but never the full-size images
    covers: () =>
      live(async () => {
        const covers = await db.photos.filter(({ isCover }) => isCover).toArray()
        return new Map(covers.map((photo) => [photo.gearId, toPhoto(photo)]))
      }),

    count: () => live(() => db.photos.count()),

    image: (id) =>
      live(async () => {
        const [photo, stored] = await Promise.all([db.photos.get(id), db.photoImages.get(id)])
        if (photo === undefined || stored === undefined) return undefined
        return new Blob([stored.image], { type: photo.mimeType })
      }),

    add: async (gearId, shrunk) => {
      // Read before the transaction, which can't wait on anything but the database
      const files = await Promise.all(
        shrunk.map(async ({ image, thumbnail, ...details }) => ({
          details,
          image: await image.arrayBuffer(),
          thumbnail: await thumbnail.arrayBuffer(),
        })),
      )
      return db.transaction('rw', [db.gear, db.photos, db.photoImages, db.settings], async () => {
        if ((await db.gear.get(gearId)) === undefined) throw new GearNotFoundError(gearId)
        const existing = await itemPhotos(gearId)
        const tooMany = photoCountProblem(existing.length, files.length)
        if (tooMany !== undefined) throw new RuleError(tooMany)
        // A millisecond apart, so photos chosen together keep the order they were chosen in
        const start = now().getTime()
        const added = files.map(({ details, image, thumbnail }, index) => {
          const at = new Date(start + index).toISOString()
          const record: PhotoRecord = {
            ...details,
            id: newId(),
            gearId,
            isCover: false,
            bytes: image.byteLength,
            thumbnailBytes: thumbnail.byteLength,
            thumbnail,
            createdAt: at,
            updatedAt: at,
          }
          return { record, image }
        })
        if (!added.every(({ record }) => isStorablePhoto(record))) {
          throw new RuleError("This photo couldn't be shrunk to save. Try another one.")
        }
        // Only a new photo can change: an item that already has photos already has its cover
        const records = added.map(({ record }) => record)
        const covers = new Map(
          coverChanges([...existing, ...records]).map((photo) => [photo.id, photo]),
        )
        const saved = records.map((record) => covers.get(record.id) ?? record)
        await db.photos.bulkAdd(saved)
        await db.photoImages.bulkAdd(added.map(({ record, image }) => ({ id: record.id, image })))
        await countChange(db, saved.length)
        return saved.map(toPhoto)
      })
    },

    setCover: (id) =>
      db.transaction('rw', db.photos, db.settings, async () => {
        const photo = await db.photos.get(id)
        if (photo === undefined) throw new RecordNotFoundError('photo', id)
        const changed = coverChanges(await itemPhotos(photo.gearId), id)
        if (changed.length === 0) return
        await saveCovers(changed)
        await countChange(db)
      }),

    remove: (id) =>
      db.transaction('rw', [db.photos, db.photoImages, db.settings], async () => {
        const photo = await db.photos.get(id)
        if (photo === undefined) return
        await db.photos.delete(id)
        await db.photoImages.delete(id)
        await saveCovers(coverChanges(await itemPhotos(photo.gearId)))
        await countChange(db)
      }),
  }
}
