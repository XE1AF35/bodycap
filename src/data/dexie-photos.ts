// The photo repository, on Dexie. A photo belongs to an item that exists, every change leaves each
// item with exactly one cover, and each change is counted for the backup reminder in the same
// transaction.
import {
  coverChanges,
  isStorablePhoto,
  photoCountProblem,
  sortPhotos,
  type Photo,
} from '@/core/photos'
import type { BodycapDatabase } from './db'
import { live } from './live'
import { countChange } from './records'
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
  const saveCovers = async (changed: readonly Photo[]) => {
    const updatedAt = now().toISOString()
    await db.photos.bulkUpdate(
      changed.map(({ id, isCover }) => ({ key: id, changes: { isCover, updatedAt } })),
    )
  }

  return {
    forGear: (gearId) => live(async () => sortPhotos(await itemPhotos(gearId))),

    // Covers can't be indexed, since IndexedDB keys can't be true or false, so every photo is read.
    // Their Blobs stay on disk until something reads them.
    covers: () =>
      live(async () => {
        const covers = await db.photos.filter(({ isCover }) => isCover).toArray()
        return new Map(covers.map((photo) => [photo.gearId, photo]))
      }),

    count: () => live(() => db.photos.count()),

    add: (gearId, shrunk) =>
      db.transaction('rw', [db.gear, db.photos, db.settings], async () => {
        if ((await db.gear.get(gearId)) === undefined) throw new GearNotFoundError(gearId)
        const existing = await itemPhotos(gearId)
        const tooMany = photoCountProblem(existing.length, shrunk.length)
        if (tooMany !== undefined) throw new RuleError(tooMany)
        // A millisecond apart, so photos chosen together keep the order they were chosen in
        const start = now().getTime()
        const added = shrunk.map(({ image, thumbnail, ...details }, index): Photo => {
          const at = new Date(start + index).toISOString()
          return {
            ...details,
            id: newId(),
            gearId,
            isCover: false,
            bytes: image.size,
            thumbnailBytes: thumbnail.size,
            image,
            thumbnail,
            createdAt: at,
            updatedAt: at,
          }
        })
        if (!added.every(isStorablePhoto)) {
          throw new RuleError("This photo couldn't be shrunk to save. Try another one.")
        }
        // Only a new photo can change: an item that already has photos already has its cover
        const covers = new Map(
          coverChanges([...existing, ...added]).map((photo) => [photo.id, photo]),
        )
        const saved = added.map((photo) => covers.get(photo.id) ?? photo)
        await db.photos.bulkAdd(saved)
        await countChange(db, saved.length)
        return saved
      }),

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
      db.transaction('rw', db.photos, db.settings, async () => {
        const photo = await db.photos.get(id)
        if (photo === undefined) return
        await db.photos.delete(id)
        await saveCovers(coverChanges(await itemPhotos(photo.gearId)))
        await countChange(db)
      }),
  }
}
