// The maintenance repository, on Dexie. A record belongs to an item that exists, and each change is
// counted for the backup reminder in the same transaction.
import type { MaintenanceRecord } from '@/core/maintenance'
import type { BodycapDatabase } from './db'
import { live } from './live'
import { countChange } from './records'
import { GearNotFoundError, RecordNotFoundError, type MaintenanceRepository } from './repositories'

export interface MaintenanceRepositoryOptions {
  readonly now: () => Date
  readonly newId: () => string
}

export function createMaintenanceRepository(
  db: BodycapDatabase,
  { now, newId }: MaintenanceRepositoryOptions,
): MaintenanceRepository {
  return {
    forGear: (gearId) => live(() => db.maintenance.where('gearId').equals(gearId).toArray()),

    add: (gearId, details) =>
      db.transaction('rw', [db.gear, db.maintenance, db.settings], async () => {
        if ((await db.gear.get(gearId)) === undefined) throw new GearNotFoundError(gearId)
        const at = now().toISOString()
        const record: MaintenanceRecord = {
          ...details,
          id: newId(),
          gearId,
          createdAt: at,
          updatedAt: at,
        }
        await db.maintenance.add(record)
        await countChange(db)
        return record
      }),

    update: (id, details) =>
      db.transaction('rw', db.maintenance, db.settings, async () => {
        const saved = await db.maintenance.get(id)
        if (saved === undefined) throw new RecordNotFoundError('maintenance', id)
        // put replaces the whole record, so a detail cleared in the form is really gone
        const record: MaintenanceRecord = {
          ...details,
          id,
          gearId: saved.gearId,
          createdAt: saved.createdAt,
          updatedAt: now().toISOString(),
        }
        await db.maintenance.put(record)
        await countChange(db)
        return record
      }),

    remove: (id) =>
      db.transaction('rw', db.maintenance, db.settings, async () => {
        if ((await db.maintenance.get(id)) === undefined) return
        await db.maintenance.delete(id)
        await countChange(db)
      }),
  }
}
