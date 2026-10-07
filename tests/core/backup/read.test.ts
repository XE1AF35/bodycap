// Reading backups: the exact round trip, upgrading format 1 files, refusing bad or newer files, and
// checking the contents, including that kits, loans, and maintenance only point at gear in the file.
import { describe, expect, it } from 'vitest'
import { createBackup } from '@/core/backup/format'
import { readBackup } from '@/core/backup/read'
import type { Gear } from '@/core/gear'
import type { Kit } from '@/core/kits'
import type { Loan } from '@/core/loans'
import type { MaintenanceRecord } from '@/core/maintenance'

const lens: Gear = {
  id: '6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90',
  createdAt: '2026-03-02T01:00:00.000Z',
  updatedAt: '2026-06-11T22:45:10.250Z',
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  serialNumber: '1834567',
  mount: 'sony-e',
  lensCoverage: 'full-frame',
  focalLengthMin: 24,
  focalLengthMax: 70,
  maxAperture: 2.8,
  purchaseDate: '2026-03-01',
  purchasePrice: { amountMinor: 389900, currency: 'NZD' },
  status: 'owned',
  warrantyExpiry: '2028-03-01',
  notes: 'Bought with the hood\nand a spare cap',
}

const soldBody: Gear = {
  id: '0b7e2d14-8c3a-4e6f-a1d9-2f5c8b3e7a60',
  createdAt: '2024-01-15T03:00:00.000Z',
  updatedAt: '2026-09-20T04:30:00.000Z',
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T4',
  mount: 'fujifilm-x',
  sensorFormat: 'aps-c',
  purchasePrice: { amountMinor: 250000, currency: 'NZD' },
  status: 'sold',
  saleDate: '2026-09-20',
  salePrice: { amountMinor: 120000, currency: 'AUD' },
}

const adapter: Gear = {
  id: 'c3d1e8f2-5a4b-4c7d-8e9f-0a1b2c3d4e5f',
  createdAt: '2025-05-05T05:05:05.000Z',
  updatedAt: '2025-05-05T05:05:05.000Z',
  category: 'mount-adapter',
  brand: 'Nikon',
  model: 'FTZ II',
  adapterFrom: 'nikon-f',
  adapterTo: 'nikon-z',
  adapterAutofocus: true,
  purchasePrice: { amountMinor: 45000, currency: 'JPY' },
  status: 'lent-out',
}

const kit: Kit = {
  id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  name: 'Travel light',
  description: 'Fits the sling.',
  gearIds: [lens.id, adapter.id],
  checklist: true,
  packedGearIds: [lens.id],
}

const loan: Loan = {
  id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
  createdAt: '2026-09-28T02:00:00.000Z',
  updatedAt: '2026-09-28T02:00:00.000Z',
  gearId: adapter.id,
  borrower: 'Aroha',
  contact: '021 123 4567',
  dateOut: '2026-09-28',
  dueDate: '2026-10-12',
}

const returnedLoan: Loan = {
  id: '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f',
  createdAt: '2026-04-01T02:00:00.000Z',
  updatedAt: '2026-04-07T02:00:00.000Z',
  gearId: lens.id,
  borrower: 'Sam',
  dateOut: '2026-04-01',
  dueDate: '2026-04-08',
  returnedOn: '2026-04-07',
}

const clean: MaintenanceRecord = {
  id: '4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a',
  createdAt: '2025-06-01T03:00:00.000Z',
  updatedAt: '2025-06-01T03:00:00.000Z',
  gearId: soldBody.id,
  type: 'sensor-clean',
  date: '2025-06-01',
  cost: { amountMinor: 8900, currency: 'NZD' },
  provider: 'Camera Clinic',
}

const firmware: MaintenanceRecord = {
  id: '5e6f7a8b-9c0d-4e1f-8a3b-4c5d6e7f8a9b',
  createdAt: '2026-08-01T03:00:00.000Z',
  updatedAt: '2026-08-01T03:00:00.000Z',
  gearId: adapter.id,
  type: 'firmware-update',
  date: '2026-08-01',
  firmwareVersion: '1.10',
}

const INFO = { schemaVersion: 1, appVersion: '0.1.0', exportedAt: '2026-10-05T03:00:00.000Z' }

const backup = createBackup(
  {
    gear: [lens, soldBody, adapter],
    kits: [kit],
    loans: [loan, returnedLoan],
    maintenance: [clean, firmware],
    settings: { lastUsedCurrency: 'AUD' },
  },
  INFO,
)

type List = 'gear' | 'kits' | 'loans' | 'maintenance'

/** The backup as text, with top-level fields replaced. Undefined leaves a field out. */
const withFile = (overrides: Record<string, unknown>) => JSON.stringify({ ...backup, ...overrides })

/** The backup with one list replaced, and its count to match */
const withList = (list: List, records: readonly unknown[]) =>
  withFile({
    counts: { ...backup.counts, [list]: records.length },
    data: { ...backup.data, [list]: records },
  })

/** A backup holding only this gear, and nothing that points at it */
const onlyGear = (gear: readonly unknown[]) =>
  withFile({
    counts: { gear: gear.length, kits: 0, loans: 0, maintenance: 0 },
    data: { gear, kits: [], loans: [], maintenance: [], settings: {} },
  })

/** A backup holding only the lens, with some of its fields replaced */
const withItem = (overrides: Record<string, unknown>) => onlyGear([{ ...lens, ...overrides }])

const MISSING = '9f8e7d6c-5b4a-4321-8fed-cba987654321'

const NOT_A_BACKUP = { ok: false, error: "This file isn't a Bodycap backup." }
const DAMAGED = { ok: false, error: "This backup is damaged, so it can't be restored." }
const INCOMPLETE = { ok: false, error: "This backup is incomplete, so it can't be restored." }
const refused = (error: string) => ({ ok: false, error })

describe('readBackup', () => {
  it('reads back exactly what was backed up', () => {
    expect(readBackup(JSON.stringify(backup))).toEqual({ ok: true, value: backup })
  })

  it('reads a backup with nothing in it', () => {
    const empty = createBackup(
      { gear: [], kits: [], loans: [], maintenance: [], settings: {} },
      INFO,
    )
    expect(readBackup(JSON.stringify(empty))).toEqual({ ok: true, value: empty })
  })

  it('upgrades a format 1 backup exactly, with no kits, loans, or maintenance', () => {
    const formatOne = {
      app: 'bodycap',
      formatVersion: 1,
      ...INFO,
      counts: { gear: 2 },
      data: { gear: [soldBody, adapter], settings: { lastUsedCurrency: 'AUD' } },
    }
    expect(readBackup(JSON.stringify(formatOne))).toEqual({
      ok: true,
      value: {
        ...formatOne,
        formatVersion: 2,
        counts: { gear: 2, kits: 0, loans: 0, maintenance: 0 },
        data: { ...formatOne.data, kits: [], loans: [], maintenance: [] },
      },
    })
  })

  it.each([
    ['text that is not JSON', 'not json'],
    ['an empty file', ''],
    ['a JSON list', '[]'],
    ['JSON null', 'null'],
    ["another app's file", '{"app":"lightroom","formatVersion":1}'],
    ['a file with no app name', withFile({ app: undefined })],
  ])('refuses %s as not a backup', (_name, text) => {
    expect(readBackup(text)).toEqual(NOT_A_BACKUP)
  })

  it('refuses a backup made by a newer version of Bodycap', () => {
    expect(readBackup(withFile({ formatVersion: 3 }))).toEqual(
      refused(
        'This backup was made by a newer version of Bodycap. Update Bodycap, then try again.',
      ),
    )
  })

  it.each([
    ['a format version of 0', { formatVersion: 0 }],
    ['a fractional format version', { formatVersion: 1.5 }],
    ['a format version written as text', { formatVersion: '1' }],
    ['no export time', { exportedAt: undefined }],
    ['an export time that is not in UTC', { exportedAt: '2026-10-05T16:00:00+13:00' }],
    ['an impossible export date', { exportedAt: '2026-02-30T00:00:00.000Z' }],
    ['no schema version', { schemaVersion: undefined }],
    ['no counts', { counts: undefined }],
    ['no data', { data: undefined }],
    ['no kits', { data: { ...backup.data, kits: undefined } }],
    ['gear that is not a list', { data: { ...backup.data, gear: {} } }],
    [
      'an unknown currency in its settings',
      { data: { ...backup.data, settings: { lastUsedCurrency: 'XYZ' } } },
    ],
  ])('refuses a backup with %s as damaged', (_name, overrides) => {
    expect(readBackup(withFile(overrides))).toEqual(DAMAGED)
  })

  it.each([
    ['an ID that is not a UUID', { id: 'abc' }],
    ['an unknown category', { category: 'spaceship' }],
    ['an unknown status', { status: 'stolen' }],
    ['no brand', { brand: undefined }],
    ['a brand that is a number', { brand: 42 }],
    ['an unknown mount', { mount: 'pentax-q' }],
    ['a negative amount', { purchasePrice: { amountMinor: -1, currency: 'NZD' } }],
    ['a fractional amount', { purchasePrice: { amountMinor: 1.5, currency: 'NZD' } }],
    [
      'an amount too large to count exactly',
      { purchasePrice: { amountMinor: 2 ** 53, currency: 'NZD' } },
    ],
    ['an unknown currency', { purchasePrice: { amountMinor: 100, currency: 'XYZ' } }],
    ['an impossible date', { purchaseDate: '2026-02-30' }],
    ['a timestamp with no time', { updatedAt: '2026-03-02' }],
    ['notes far too long to be real', { notes: 'x'.repeat(50_001) }],
    ['autofocus that is not true or false', { adapterAutofocus: 'yes' }],
    ['a focal length written as text', { focalLengthMin: '24' }],
  ])('names the damaged item when it has %s', (_name, overrides) => {
    expect(readBackup(withItem(overrides))).toEqual(
      refused("Item 1 in this backup is damaged, so it can't be restored."),
    )
  })

  it('counts items from 1 when naming the damaged one', () => {
    expect(readBackup(withList('gear', [lens, soldBody, { ...adapter, id: 'x' }]))).toEqual(
      refused("Item 3 in this backup is damaged, so it can't be restored."),
    )
  })

  it.each<[List, unknown, string]>([
    ['kits', { ...kit, gearIds: 'all of it' }, 'Kit 1'],
    ['kits', { ...kit, checklist: 'yes' }, 'Kit 1'],
    ['loans', { ...loan, dueDate: '2026-02-30' }, 'Loan 1'],
    ['loans', { ...loan, gearId: 'the adapter' }, 'Loan 1'],
    ['maintenance', { ...clean, type: 'polish' }, 'Maintenance record 1'],
    [
      'maintenance',
      { ...clean, cost: { amountMinor: 89.5, currency: 'NZD' } },
      'Maintenance record 1',
    ],
  ])('names the damaged record in %s', (list, record, name) => {
    expect(readBackup(withList(list, [record]))).toEqual(
      refused(`${name} in this backup is damaged, so it can't be restored.`),
    )
  })

  it('counts other records from 1 too', () => {
    expect(readBackup(withList('maintenance', [clean, { ...firmware, date: 'soon' }]))).toEqual(
      refused("Maintenance record 2 in this backup is damaged, so it can't be restored."),
    )
  })

  it.each<[string, Record<string, unknown>]>([
    ['gear', { gear: 4 }],
    ['kits', { kits: 2 }],
    ['loans', { loans: 1 }],
    ['maintenance', { maintenance: 0 }],
  ])('refuses a backup whose count of %s does not match what is in it', (_name, counts) => {
    expect(readBackup(withFile({ counts: { ...backup.counts, ...counts } }))).toEqual(INCOMPLETE)
  })

  it.each<[List, unknown, string]>([
    ['gear', lens, 'item'],
    ['kits', kit, 'kit'],
    ['loans', returnedLoan, 'loan'],
    ['maintenance', clean, 'maintenance record'],
  ])('refuses a backup with the same record twice in %s', (list, record, noun) => {
    expect(readBackup(withList(list, [record, record]))).toEqual(
      refused(`This backup has the same ${noun} twice, so it can't be restored.`),
    )
  })

  it.each([
    [
      { status: 'sold', saleDate: '2026-02-01', salePrice: { amountMinor: 1, currency: 'NZD' } },
      "The sale date can't be before the purchase date.",
    ],
    [{ purchaseDate: '2026-10-07' }, "The purchase date can't be in the future."],
    [{ brand: '   ' }, 'Enter the brand.'],
    [{ notes: 'x'.repeat(5001) }, 'Keep the notes to 5,000 characters or fewer.'],
    [{ status: 'lost' }, 'Enter the date it was lost.'],
    [
      { focalLengthMin: 70, focalLengthMax: 24 },
      "The longest focal length can't be shorter than the shortest.",
    ],
    [{ maxAperture: 0.1 }, 'Enter an f-number from 0.7 to 64.'],
  ])('refuses an item the app would not save, %j: %s', (overrides, message) => {
    expect(readBackup(withItem(overrides))).toEqual(
      refused(`Item 1 in this backup has a problem: ${message}`),
    )
  })

  it.each<[List, unknown, string]>([
    [
      'kits',
      { ...kit, name: '  ' },
      'Kit 1 in this backup has a problem: Enter a name for the kit.',
    ],
    [
      'loans',
      { ...loan, dueDate: '2026-09-01' },
      "Loan 1 in this backup has a problem: It can't be due back before it went out.",
    ],
    [
      'loans',
      { ...loan, dateOut: '2026-10-07' },
      "Loan 1 in this backup has a problem: The date it went out can't be in the future.",
    ],
    [
      'loans',
      { ...returnedLoan, returnedOn: '2026-03-31' },
      "Loan 1 in this backup has a problem: It can't have come back before it went out.",
    ],
    [
      'maintenance',
      { ...clean, date: '2026-10-07' },
      "Maintenance record 1 in this backup has a problem: The date can't be in the future.",
    ],
  ])('refuses a record in %s the app would not save', (list, record, message) => {
    expect(readBackup(withList(list, [record]))).toEqual(refused(message))
  })

  it.each<[string, List, unknown, string]>([
    [
      'a kit listing gear that is not in the backup',
      'kits',
      { ...kit, gearIds: [lens.id, MISSING] },
      "Kit 1 in this backup lists gear that isn't in the backup, so it can't be restored.",
    ],
    [
      'a loan for gear that is not in the backup',
      'loans',
      { ...loan, gearId: MISSING },
      "Loan 1 in this backup is for gear that isn't in the backup, so it can't be restored.",
    ],
    [
      'maintenance for gear that is not in the backup',
      'maintenance',
      { ...clean, gearId: MISSING },
      "Maintenance record 1 in this backup is for gear that isn't in the backup, so it can't be restored.",
    ],
  ])('refuses %s', (_name, list, record, message) => {
    expect(readBackup(withList(list, [record]))).toEqual(refused(message))
  })

  it('refuses a backup missing gear that its kits and loans point at', () => {
    expect(readBackup(withList('gear', [soldBody]))).toEqual(
      refused("Kit 1 in this backup lists gear that isn't in the backup, so it can't be restored."),
    )
  })

  it.each([
    ['ticks gear that is not in it', { ...kit, packedGearIds: [soldBody.id] }],
    ['has ticks while its checklist is off', { ...kit, checklist: false }],
    ['lists the same gear twice', { ...kit, gearIds: [lens.id, lens.id] }],
  ])('refuses a kit that %s as damaged', (_name, record) => {
    expect(readBackup(withList('kits', [record]))).toEqual(
      refused("Kit 1 in this backup is damaged, so it can't be restored."),
    )
  })

  it('refuses an item out on two loans at once', () => {
    const second = { ...loan, id: MISSING, borrower: 'Sam' }
    expect(readBackup(withList('loans', [loan, second]))).toEqual(
      refused('Loan 2 in this backup has a problem: The item is already out on another loan.'),
    )
  })

  it('accepts dates up to a day after the export, for time zones ahead of UTC', () => {
    expect(readBackup(withItem({ purchaseDate: '2026-10-06' }))).toMatchObject({ ok: true })
  })

  it('tidies text and drops fields that no longer apply, as the form would', () => {
    const result = readBackup(withItem({ brand: '  Sony ', saleDate: '2026-09-01' }))
    expect(result).toMatchObject({ ok: true, value: { data: { gear: [lens] } } })
    expect(result.ok && result.value.data.gear[0]).not.toHaveProperty('saleDate')
  })

  it('drops lens optics from gear that is not a lens', () => {
    const result = readBackup(onlyGear([{ ...soldBody, focalLengthMin: 23, focalLengthMax: 23 }]))
    expect(result).toEqual({ ok: true, value: JSON.parse(onlyGear([soldBody])) as unknown })
  })

  it('drops keys it does not know', () => {
    const result = readBackup(
      JSON.stringify({
        ...backup,
        extra: 'top level',
        counts: { ...backup.counts, shoots: 3 },
        data: {
          ...backup.data,
          gear: [{ ...lens, serialKey: '1834567' }, soldBody, adapter],
          shoots: [],
        },
      }),
    )
    expect(result).toEqual({ ok: true, value: backup })
  })

  it('does not let a __proto__ key change other objects', () => {
    const text = withItem({}).replace('"id":', '"__proto__":{"polluted":true},"id":')
    expect(text).toContain('__proto__')
    expect(readBackup(text)).toMatchObject({ ok: true })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
