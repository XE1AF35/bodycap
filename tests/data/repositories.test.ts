// Gear and settings repositories on fake-indexeddb: saving, live updates, and change counts.
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GearFields } from '@/core/gear'
import { BodycapDatabase } from '@/data/db'
import { createRepositories } from '@/data/dexie-repositories'
import { GearNotFoundError, type Live, type Repositories } from '@/data/repositories'

/** The required fields and a mount, with nothing optional that an update could clear */
const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  mount: 'sony-e',
  status: 'owned',
}

const lensFields: GearFields = {
  ...lens,
  nickname: 'Workhorse',
  serialNumber: 'ab-12 34',
  purchasePrice: { amountMinor: 389900, currency: 'NZD' },
}

const START = '2026-10-05T01:00:00.000Z'
const LATER = '2026-10-05T01:05:00.000Z'
const firstId = '00000000-0000-4000-8000-000000000001'

let db: BodycapDatabase
let repos: Repositories
let clock: string
const stops: (() => void)[] = []

beforeEach(() => {
  db = new BodycapDatabase({ indexedDB: new IDBFactory(), IDBKeyRange })
  clock = START
  let ids = 0
  repos = createRepositories(db, {
    now: () => new Date(clock),
    newId: () => {
      ids += 1
      return `00000000-0000-4000-8000-${String(ids).padStart(12, '0')}`
    },
  })
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
  db.close()
})

/** Collects every value a live query gives, for checking with vi.waitFor */
function watch<T>(live: Live<T>) {
  const values: T[] = []
  const errors: unknown[] = []
  stops.push(
    live.subscribe(
      (value) => values.push(value),
      (error) => errors.push(error),
    ),
  )
  return { values, errors, latest: () => values.at(-1) }
}

const changesSinceBackup = async () => {
  const settings = watch(repos.settings.get())
  await vi.waitFor(() => {
    expect(settings.latest()).toBeDefined()
  })
  return settings.latest()?.changesSinceBackup
}

describe('database', () => {
  it('has the version 1 tables and indexes, which must never change once released', async () => {
    await db.open()
    expect(db.verno).toBe(1)
    expect(
      db.tables.map(({ name, schema }) => ({
        name,
        key: schema.primKey.name,
        indexes: schema.indexes.map((index) => index.name),
      })),
    ).toEqual([
      {
        name: 'gear',
        key: 'id',
        indexes: ['category', 'status', 'mount', 'serialKey', 'warrantyExpiry', 'updatedAt'],
      },
      { name: 'settings', key: 'key', indexes: [] },
    ])
  })
})

describe('gear repository', () => {
  it('adds an item with a new ID and timestamps, and counts the change', async () => {
    const added = await repos.gear.add(lensFields)
    expect(added).toEqual({ ...lensFields, id: firstId, createdAt: START, updatedAt: START })
    const item = watch(repos.gear.get(firstId))
    await vi.waitFor(() => {
      expect(item.latest()).toEqual(added)
    })
    expect(await changesSinceBackup()).toBe(1)
  })

  it('stores a normalised serial for the index, without handing it back', async () => {
    await repos.gear.add(lensFields)
    expect(await db.gear.get(firstId)).toMatchObject({ serialKey: 'AB1234' })
    const item = watch(repos.gear.get(firstId))
    await vi.waitFor(() => {
      expect(item.latest()).toBeDefined()
    })
    expect(item.latest()).not.toHaveProperty('serialKey')
  })

  it('stores no serial key for an item without a serial', async () => {
    await repos.gear.add(lens)
    expect(await db.gear.get(firstId)).not.toHaveProperty('serialKey')
  })

  it('replaces every detail on update, keeping the ID and when it was added', async () => {
    await repos.gear.add(lensFields)
    clock = LATER
    const changed: GearFields = { ...lens, status: 'in-repair' }
    const updated = await repos.gear.update(firstId, changed)
    expect(updated).toEqual({ ...changed, id: firstId, createdAt: START, updatedAt: LATER })
    expect(await db.gear.get(firstId)).toEqual({ ...updated })
    expect(await changesSinceBackup()).toBe(2)
  })

  it('refuses to update an item that is no longer there, counting nothing', async () => {
    await expect(repos.gear.update(firstId, lensFields)).rejects.toThrow(GearNotFoundError)
    expect(await changesSinceBackup()).toBe(0)
  })

  it('removes an item and counts the change', async () => {
    await repos.gear.add(lensFields)
    await repos.gear.remove(firstId)
    expect(await db.gear.count()).toBe(0)
    expect(await changesSinceBackup()).toBe(2)
  })

  it('does nothing when removing an item that is already gone', async () => {
    await repos.gear.remove(firstId)
    expect(await changesSinceBackup()).toBe(0)
  })

  it('keeps a live list up to date as items are added, changed, and removed', async () => {
    const list = watch(repos.gear.list())
    await vi.waitFor(() => {
      expect(list.latest()).toEqual([])
    })
    const added = await repos.gear.add(lensFields)
    await vi.waitFor(() => {
      expect(list.latest()).toEqual([added])
    })
    const updated = await repos.gear.update(firstId, { ...lensFields, status: 'lent-out' })
    await vi.waitFor(() => {
      expect(list.latest()).toEqual([updated])
    })
    await repos.gear.remove(firstId)
    await vi.waitFor(() => {
      expect(list.latest()).toEqual([])
    })
    expect(list.errors).toEqual([])
  })

  it('gives undefined for an item until it exists', async () => {
    const item = watch(repos.gear.get(firstId))
    await vi.waitFor(() => {
      expect(item.values).toEqual([undefined])
    })
    const added = await repos.gear.add(lensFields)
    await vi.waitFor(() => {
      expect(item.latest()).toEqual(added)
    })
  })
})

describe('settings repository', () => {
  it('starts with no changes counted and nothing else set', async () => {
    const settings = watch(repos.settings.get())
    await vi.waitFor(() => {
      expect(settings.latest()).toEqual({ changesSinceBackup: 0 })
    })
  })

  it('remembers the last currency used, without counting it as a change', async () => {
    await repos.settings.setLastUsedCurrency('AUD')
    const settings = watch(repos.settings.get())
    await vi.waitFor(() => {
      expect(settings.latest()).toEqual({ changesSinceBackup: 0, lastUsedCurrency: 'AUD' })
    })
  })

  it('reads the time of the last backup', async () => {
    await db.settings.put({ key: 'lastBackupAt', value: START })
    const settings = watch(repos.settings.get())
    await vi.waitFor(() => {
      expect(settings.latest()).toEqual({ changesSinceBackup: 0, lastBackupAt: START })
    })
  })

  it('ignores stored values of the wrong kind', async () => {
    await db.settings.bulkPut([
      { key: 'changesSinceBackup', value: 'lots' },
      { key: 'lastUsedCurrency', value: 'XYZ' },
      { key: 'lastBackupAt', value: 42 },
    ])
    const settings = watch(repos.settings.get())
    await vi.waitFor(() => {
      expect(settings.latest()).toEqual({ changesSinceBackup: 0 })
    })
    await repos.gear.add(lensFields)
    expect(await changesSinceBackup()).toBe(1)
  })
})
