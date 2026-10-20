// The shoot repository, on Dexie. Only items that exist can go on a shoot, and deleting an item
// takes it off every shoot, so a shoot never points at gear that's gone.
import type { Shoot } from '@/core/shoots'
import type { BodycapDatabase } from './db'
import { live } from './live'
import { checkGearExists, countChange } from './records'
import { RecordNotFoundError, type ShootRepository } from './repositories'

export interface ShootRepositoryOptions {
  readonly now: () => Date
  readonly newId: () => string
}

export function createShootRepository(
  db: BodycapDatabase,
  { now, newId }: ShootRepositoryOptions,
): ShootRepository {
  return {
    list: () => live(() => db.shoots.toArray()),

    get: (id) => live(() => db.shoots.get(id)),

    withGear: (gearId) =>
      live(() => db.shoots.where('gearIds').equals(gearId).distinct().toArray()),

    add: (fields) =>
      db.transaction('rw', [db.shoots, db.gear, db.settings], async () => {
        await checkGearExists(db, fields.gearIds)
        const at = now().toISOString()
        const shoot: Shoot = { ...fields, id: newId(), createdAt: at, updatedAt: at }
        await db.shoots.add(shoot)
        await countChange(db)
        return shoot
      }),

    update: (id, fields) =>
      db.transaction('rw', [db.shoots, db.gear, db.settings], async () => {
        const saved = await db.shoots.get(id)
        if (saved === undefined) throw new RecordNotFoundError('shoot', id)
        await checkGearExists(db, fields.gearIds)
        const shoot: Shoot = {
          ...fields,
          id,
          createdAt: saved.createdAt,
          updatedAt: now().toISOString(),
        }
        // put replaces the whole record, so notes cleared in the form are really gone
        await db.shoots.put(shoot)
        await countChange(db)
        return shoot
      }),

    remove: (id) =>
      db.transaction('rw', db.shoots, db.settings, async () => {
        if ((await db.shoots.get(id)) === undefined) return
        await db.shoots.delete(id)
        await countChange(db)
      }),
  }
}
