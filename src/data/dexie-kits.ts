// The kit repository, on Dexie. Each change is applied to the kit as saved, inside a transaction,
// and only gear that exists can go in a kit, so a backup never points at gear it doesn't hold.
import { newKit, type Kit, type KitFields } from '@/core/kits'
import type { BodycapDatabase } from './db'
import { live } from './live'
import { countChange } from './records'
import { GearNotFoundError, RecordNotFoundError, type KitRepository } from './repositories'

export interface KitRepositoryOptions {
  readonly now: () => Date
  readonly newId: () => string
}

// Ticks come and go every trip, so packing alone isn't counted towards the backup reminder
function onlyTicksChanged(before: KitFields, after: KitFields): boolean {
  return (
    before.name === after.name &&
    before.description === after.description &&
    before.checklist === after.checklist &&
    before.gearIds.length === after.gearIds.length &&
    before.gearIds.every((id, index) => id === after.gearIds[index])
  )
}

export function createKitRepository(
  db: BodycapDatabase,
  { now, newId }: KitRepositoryOptions,
): KitRepository {
  return {
    list: () => live(() => db.kits.toArray()),

    get: (id) => live(() => db.kits.get(id)),

    withGear: (gearId) => live(() => db.kits.where('gearIds').equals(gearId).distinct().toArray()),

    add: (details) =>
      db.transaction('rw', db.kits, db.settings, async () => {
        const at = now().toISOString()
        const kit: Kit = { ...newKit(details), id: newId(), createdAt: at, updatedAt: at }
        await db.kits.add(kit)
        await countChange(db)
        return kit
      }),

    update: (id, change) =>
      db.transaction('rw', [db.kits, db.gear, db.settings], async () => {
        const saved = await db.kits.get(id)
        if (saved === undefined) throw new RecordNotFoundError('kit', id)
        const fields = change(saved)
        const found = await db.gear.bulkGet([...fields.gearIds])
        const missing = fields.gearIds.find((_, index) => found[index] === undefined)
        if (missing !== undefined) throw new GearNotFoundError(missing)
        const kit: Kit = {
          ...fields,
          id,
          createdAt: saved.createdAt,
          updatedAt: now().toISOString(),
        }
        await db.kits.put(kit)
        if (!onlyTicksChanged(saved, kit)) await countChange(db)
        return kit
      }),

    remove: (id) =>
      db.transaction('rw', db.kits, db.settings, async () => {
        if ((await db.kits.get(id)) === undefined) return
        await db.kits.delete(id)
        await countChange(db)
      }),
  }
}
