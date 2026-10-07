// Upgrading a database made by version 1 of Bodycap: opening it as version 2 keeps every item,
// setting, and index, and adds empty tables for kits, loans, and maintenance.
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
  it('keeps every item, setting, and index, and adds empty kits, loans, and maintenance', async () => {
    const indexedDB = new IDBFactory()
    const old = new Dexie('bodycap', { indexedDB, IDBKeyRange })
    old.version(1).stores(VERSION_1)
    await old.table('gear').bulkAdd(gear)
    await old.table('settings').bulkAdd(settings)
    old.close()

    const db = new BodycapDatabase({ indexedDB, IDBKeyRange })
    opened.push(db)
    await db.open()
    expect(db.verno).toBe(2)
    expect(await db.gear.toArray()).toEqual(gear)
    expect(await db.settings.toArray()).toEqual(settings)
    expect(await db.gear.where('serialKey').equals('1AB2345').count()).toBe(1)
    expect(await db.gear.where('status').equals('owned').primaryKeys()).toEqual([gear[1]?.id])
    expect([await db.kits.count(), await db.loans.count(), await db.maintenance.count()]).toEqual([
      0, 0, 0,
    ])
  })
})
