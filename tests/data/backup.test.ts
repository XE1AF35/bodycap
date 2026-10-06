// Backing up and restoring on fake-indexeddb: the exact round trip, all-or-nothing restore, and the
// backup reminder's bookkeeping.
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import type { Backup } from '@/core/backup/format'
import { readBackup } from '@/core/backup/read'
import type { GearFields } from '@/core/gear'
import { BodycapDatabase } from '@/data/db'
import { createRepositories } from '@/data/dexie-repositories'
import type { Live } from '@/data/repositories'

const EXPORTED_AT = '2026-10-04T12:30:00.000Z'

const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  serialNumber: 'ab-12 34',
  mount: 'sony-e',
  lensCoverage: 'full-frame',
  purchaseDate: '2026-03-01',
  purchasePrice: { amountMinor: 389900, currency: 'NZD' },
  status: 'owned',
  notes: 'Bought with the hood\nand a spare cap',
}

const soldBody: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T4',
  mount: 'fujifilm-x',
  sensorFormat: 'aps-c',
  status: 'sold',
  saleDate: '2026-09-20',
  salePrice: { amountMinor: 120000, currency: 'AUD' },
}

const adapter: GearFields = {
  category: 'mount-adapter',
  brand: 'Nikon',
  model: 'FTZ II',
  adapterFrom: 'nikon-f',
  adapterTo: 'nikon-z',
  adapterAutofocus: true,
  purchasePrice: { amountMinor: 45000, currency: 'JPY' },
  status: 'lent-out',
}

const opened: BodycapDatabase[] = []
let ids = 0

afterEach(() => {
  for (const db of opened.splice(0)) db.close()
})

/** A new, empty database with its repositories, on a fixed clock */
function open() {
  const db = new BodycapDatabase({ indexedDB: new IDBFactory(), IDBKeyRange })
  opened.push(db)
  const repos = createRepositories(db, {
    now: () => new Date(EXPORTED_AT),
    newId: () => {
      ids += 1
      return `00000000-0000-4000-8000-${String(ids).padStart(12, '0')}`
    },
    appVersion: '0.1.0',
    // 12:30 UTC is 1:30 the next morning in New Zealand, so the file is named for the 5th
    timeZone: 'Pacific/Auckland',
  })
  return { db, repos }
}

/** The first value a live query gives */
function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}

/** A database holding three items and a remembered currency, backed up */
async function backedUp() {
  const source = open()
  const gear = [
    await source.repos.gear.add(lens),
    await source.repos.gear.add(soldBody),
    await source.repos.gear.add(adapter),
  ]
  await source.repos.settings.setLastUsedCurrency('AUD')
  const file = await source.repos.backup.create()
  const read = readBackup(file.text)
  if (!read.ok) throw new Error(read.error)
  return { source, gear, file, backup: read.value }
}

describe('backup.create', () => {
  it('makes a file named for the local date, holding every item and portable setting', async () => {
    const { file, gear, backup } = await backedUp()
    expect(file.name).toBe('bodycap-backup-2026-10-05.json')
    expect(backup).toEqual({
      app: 'bodycap',
      formatVersion: 1,
      schemaVersion: 1,
      appVersion: '0.1.0',
      exportedAt: EXPORTED_AT,
      counts: { gear: 3 },
      data: { gear, settings: { lastUsedCurrency: 'AUD' } },
    })
  })

  it("records the app's version from the build by default", async () => {
    const db = new BodycapDatabase({ indexedDB: new IDBFactory(), IDBKeyRange })
    opened.push(db)
    const file = await createRepositories(db).backup.create()
    expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+/)
    expect(readBackup(file.text)).toMatchObject({
      ok: true,
      value: { appVersion: __APP_VERSION__ },
    })
  })

  it('records the backup, then counts changes from zero again', async () => {
    const { source } = await backedUp()
    expect(await current(source.repos.settings.get())).toEqual({
      lastBackupAt: EXPORTED_AT,
      changesSinceBackup: 0,
      lastUsedCurrency: 'AUD',
    })
    await source.repos.gear.add(lens)
    expect(await current(source.repos.settings.get())).toMatchObject({ changesSinceBackup: 1 })
  })
})

describe('backup.restore', () => {
  it('restores exactly what was backed up into another database', async () => {
    const { source, backup } = await backedUp()
    const target = open()
    await target.repos.backup.restore(backup)
    expect(await target.db.gear.toArray()).toEqual(await source.db.gear.toArray())
    expect(await current(target.repos.gear.list())).toEqual(await current(source.repos.gear.list()))
    expect(await target.db.gear.where('serialKey').equals('AB1234').count()).toBe(1)
  })

  it('replaces everything already there, settings included', async () => {
    const { backup } = await backedUp()
    const target = open()
    await target.repos.gear.add({ ...lens, model: 'FE 85mm F1.8' })
    await target.repos.settings.setLastUsedCurrency('USD')
    const withoutCurrency: Backup = { ...backup, data: { ...backup.data, settings: {} } }
    await target.repos.backup.restore(withoutCurrency)
    expect(await current(target.repos.gear.list())).toEqual(backup.data.gear)
    expect(await current(target.repos.settings.get())).not.toHaveProperty('lastUsedCurrency')
  })

  it('counts the restored data as backed up when the file was made', async () => {
    const { backup } = await backedUp()
    const target = open()
    await target.repos.gear.add(lens)
    await target.repos.backup.restore({ ...backup, exportedAt: '2026-09-01T00:00:00.000Z' })
    expect(await current(target.repos.settings.get())).toEqual({
      lastBackupAt: '2026-09-01T00:00:00.000Z',
      changesSinceBackup: 0,
      lastUsedCurrency: 'AUD',
    })
  })

  it('leaves everything as it was when a restore fails part way through', async () => {
    const { backup } = await backedUp()
    const target = open()
    const kept = await target.repos.gear.add({ ...lens, model: 'FE 85mm F1.8' })
    await target.repos.settings.setLastUsedCurrency('USD')
    const [first] = backup.data.gear
    if (first === undefined) throw new Error('The backup has no gear')
    // readBackup refuses repeated IDs, so this can only come from a bug, but the write must still
    // be all or nothing
    const broken: Backup = {
      ...backup,
      counts: { gear: 2 },
      data: { ...backup.data, gear: [first, first] },
    }
    await expect(target.repos.backup.restore(broken)).rejects.toThrow()
    expect(await current(target.repos.gear.list())).toEqual([kept])
    expect(await current(target.repos.settings.get())).toEqual({
      changesSinceBackup: 1,
      lastUsedCurrency: 'USD',
    })
  })
})
