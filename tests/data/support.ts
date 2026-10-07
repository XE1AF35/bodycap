// Helpers for storage tests: a new database on fake-indexeddb with a clock and IDs the test
// controls, and the first value a live query gives.
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import type { GearFields } from '@/core/gear'
import { BodycapDatabase } from '@/data/db'
import { createRepositories } from '@/data/dexie-repositories'
import type { Live } from '@/data/repositories'

/** 1am UTC, which is 2pm on 7 October in New Zealand */
export const NOW = '2026-10-07T01:00:00.000Z'
export const TODAY = '2026-10-07'

const opened: BodycapDatabase[] = []

/** A new, empty database and its repositories. Move `clock.now` on to make time pass. */
export function openRepositories() {
  const db = new BodycapDatabase({ indexedDB: new IDBFactory(), IDBKeyRange })
  opened.push(db)
  const clock = { now: NOW }
  let ids = 0
  const repos = createRepositories(db, {
    now: () => new Date(clock.now),
    newId: () => {
      ids += 1
      return `00000000-0000-4000-8000-${String(ids).padStart(12, '0')}`
    },
    timeZone: 'Pacific/Auckland',
  })
  return { db, repos, clock }
}

/** Closes every database opened since the last call. Run it after each test. */
export function closeDatabases(): void {
  for (const db of opened.splice(0)) db.close()
}

/** The first value a live query gives */
export function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}

export const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  mount: 'sony-e',
  focalLengthMin: 24,
  focalLengthMax: 70,
  maxAperture: 2.8,
  status: 'owned',
}

export const body: GearFields = {
  category: 'camera-body',
  brand: 'Sony',
  model: 'A7 IV',
  mount: 'sony-e',
  sensorFormat: 'full-frame',
  status: 'owned',
}
