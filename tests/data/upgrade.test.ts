// Upgrading databases made by older versions of Bodycap: opening a version 1 or 2 database as the
// current version keeps every record and index, and adds the newer tables empty.
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { BodycapDatabase } from '@/data/db'

const opened: Dexie[] = []

afterEach(() => {
  for (const db of opened.splice(0)) db.close()
})

// Written out here rather than imported, so this test keeps checking against the released tables
const VERSION_1 = {
  gear: 'id, category, status, mount, serialKey, warrantyExpiry, updatedAt',
  settings: 'key',
}

const VERSION_2 = {
  kits: 'id, name, *gearIds',
  loans: 'id, gearId, dueDate, [gearId+dateOut]',
  maintenance: 'id, gearId, date, [gearId+date]',
}

const gear = [
  {
    id: '0b7e2d14-8c3a-4e6f-a1d9-2f5c8b3e7a60',
    createdAt: '2024-01-15T03:00:00.000Z',
    updatedAt: '2026-09-20T04:30:00.000Z',
    category: 'camera-body',
    brand: 'Fujifilm',
    model: 'X-T4',
    serialNumber: '1AB 2345',
    serialKey: '1AB2345',
    mount: 'fujifilm-x',
    status: 'sold',
    saleDate: '2026-09-20',
    salePrice: { amountMinor: 120000, currency: 'AUD' },
  },
  {
    id: '6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90',
    createdAt: '2026-03-02T01:00:00.000Z',
    updatedAt: '2026-06-11T22:45:10.250Z',
    category: 'lens',
    brand: 'Sony',
    model: 'FE 24-70mm F2.8 GM II',
    mount: 'sony-e',
    status: 'owned',
    warrantyExpiry: '2028-03-01',
    notes: 'Bought with the hood\nand a spare cap',
  },
]

const settings = [
  { key: 'changesSinceBackup', value: 4 },
  { key: 'lastBackupAt', value: '2026-10-01T00:00:00.000Z' },
  { key: 'lastUsedCurrency', value: 'AUD' },
]

describe('upgrading from version 1', () => {
  it('keeps every item, setting, and index, and adds the newer tables empty', async () => {
    const indexedDB = new IDBFactory()
    const old = new Dexie('bodycap', { indexedDB, IDBKeyRange })
    old.version(1).stores(VERSION_1)
    await old.table('gear').bulkAdd(gear)
    await old.table('settings').bulkAdd(settings)
    old.close()

    const db = new BodycapDatabase({ indexedDB, IDBKeyRange })
    opened.push(db)
    await db.open()
    expect(db.verno).toBe(3)
    expect(await db.gear.toArray()).toEqual(gear)
    expect(await db.settings.toArray()).toEqual(settings)
    expect(await db.gear.where('serialKey').equals('1AB2345').count()).toBe(1)
    expect(await db.gear.where('status').equals('owned').primaryKeys()).toEqual([gear[1]?.id])
    expect([
      await db.kits.count(),
      await db.loans.count(),
      await db.maintenance.count(),
      await db.photos.count(),
      await db.photoImages.count(),
    ]).toEqual([0, 0, 0, 0, 0])
  })
})

describe('upgrading from version 2', () => {
  const kit = {
    id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    name: 'Travel light',
    gearIds: [gear[1]?.id],
    checklist: true,
    packedGearIds: [gear[1]?.id],
  }
  const loan = {
    id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
    createdAt: '2026-09-28T02:00:00.000Z',
    updatedAt: '2026-09-28T02:00:00.000Z',
    gearId: gear[1]?.id,
    borrower: 'Aroha',
    dateOut: '2026-09-28',
    dueDate: '2026-10-12',
  }
  const clean = {
    id: '4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a',
    createdAt: '2025-06-01T03:00:00.000Z',
    updatedAt: '2025-06-01T03:00:00.000Z',
    gearId: gear[0]?.id,
    type: 'sensor-clean',
    date: '2025-06-01',
  }

  it('keeps every record and index, and adds photos empty', async () => {
    const indexedDB = new IDBFactory()
    const old = new Dexie('bodycap', { indexedDB, IDBKeyRange })
    old.version(1).stores(VERSION_1)
    old.version(2).stores(VERSION_2)
    await old.table('gear').bulkAdd(gear)
    await old.table('settings').bulkAdd(settings)
    await old.table('kits').add(kit)
    await old.table('loans').add(loan)
    await old.table('maintenance').add(clean)
    old.close()

    const db = new BodycapDatabase({ indexedDB, IDBKeyRange })
    opened.push(db)
    await db.open()
    expect(db.verno).toBe(3)
    expect(await db.gear.toArray()).toEqual(gear)
    expect(await db.settings.toArray()).toEqual(settings)
    expect(
      await db.kits
        .where('gearIds')
        .equals(gear[1]?.id ?? '')
        .toArray(),
    ).toEqual([kit])
    expect(await db.loans.where('dueDate').equals('2026-10-12').toArray()).toEqual([loan])
    expect(
      await db.maintenance
        .where('gearId')
        .equals(gear[0]?.id ?? '')
        .toArray(),
    ).toEqual([clean])
    expect([await db.photos.count(), await db.photoImages.count()]).toEqual([0, 0])
  })
})
