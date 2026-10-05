// Reading backups: the exact round trip, refusing bad or newer files, and checking the contents.
import { describe, expect, it } from 'vitest'
import { createBackup } from '@/core/backup/format'
import { readBackup } from '@/core/backup/read'
import type { Gear } from '@/core/gear'

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

const backup = createBackup(
  { gear: [lens, soldBody, adapter], settings: { lastUsedCurrency: 'AUD' } },
  { schemaVersion: 1, appVersion: '0.1.0', exportedAt: '2026-10-05T03:00:00.000Z' },
)

/** The backup as text, with top-level fields replaced. Undefined leaves a field out. */
const withFile = (overrides: Record<string, unknown>) => JSON.stringify({ ...backup, ...overrides })

/** A backup holding only the lens, with some of its fields replaced */
const withItem = (overrides: Record<string, unknown>) =>
  withFile({ counts: { gear: 1 }, data: { ...backup.data, gear: [{ ...lens, ...overrides }] } })

const NOT_A_BACKUP = { ok: false, error: "This file isn't a Bodycap backup." }
const DAMAGED = { ok: false, error: "This backup is damaged, so it can't be restored." }

describe('readBackup', () => {
  it('reads back exactly what was backed up', () => {
    expect(readBackup(JSON.stringify(backup))).toEqual({ ok: true, value: backup })
  })

  it('reads a backup with no gear and no settings', () => {
    const empty = createBackup(
      { gear: [], settings: {} },
      { schemaVersion: 1, appVersion: '0.1.0', exportedAt: '2026-10-05T03:00:00Z' },
    )
    expect(readBackup(JSON.stringify(empty))).toEqual({ ok: true, value: empty })
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
    expect(readBackup(withFile({ formatVersion: 2 }))).toEqual({
      ok: false,
      error: 'This backup was made by a newer version of Bodycap. Update Bodycap, then try again.',
    })
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
    ['gear that is not a list', { data: { gear: {}, settings: {} } }],
    [
      'an unknown currency in its settings',
      { counts: { gear: 0 }, data: { gear: [], settings: { lastUsedCurrency: 'XYZ' } } },
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
  ])('names the damaged item when it has %s', (_name, overrides) => {
    expect(readBackup(withItem(overrides))).toEqual({
      ok: false,
      error: "Item 1 in this backup is damaged, so it can't be restored.",
    })
  })

  it('counts items from 1 when naming the damaged one', () => {
    const text = withFile({
      data: { ...backup.data, gear: [lens, soldBody, { ...adapter, id: 'x' }] },
    })
    expect(readBackup(text)).toEqual({
      ok: false,
      error: "Item 3 in this backup is damaged, so it can't be restored.",
    })
  })

  it('refuses a backup whose counts do not match what is in it', () => {
    expect(readBackup(withFile({ counts: { gear: 4 } }))).toEqual({
      ok: false,
      error: "This backup is incomplete, so it can't be restored.",
    })
  })

  it('refuses a backup with the same item twice', () => {
    const text = withFile({ counts: { gear: 2 }, data: { ...backup.data, gear: [lens, lens] } })
    expect(readBackup(text)).toEqual({
      ok: false,
      error: "This backup has the same item twice, so it can't be restored.",
    })
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
  ])('refuses an item the app would not save, %j: %s', (overrides, message) => {
    expect(readBackup(withItem(overrides))).toEqual({
      ok: false,
      error: `Item 1 in this backup has a problem: ${message}`,
    })
  })

  it('accepts dates up to a day after the export, for time zones ahead of UTC', () => {
    expect(readBackup(withItem({ purchaseDate: '2026-10-06' }))).toMatchObject({ ok: true })
  })

  it('tidies text and drops fields that no longer apply, as the form would', () => {
    const result = readBackup(withItem({ brand: '  Sony ', saleDate: '2026-09-01' }))
    expect(result).toMatchObject({ ok: true, value: { data: { gear: [lens] } } })
    expect(result.ok && result.value.data.gear[0]).not.toHaveProperty('saleDate')
  })

  it('drops keys it does not know', () => {
    const result = readBackup(
      JSON.stringify({
        ...backup,
        extra: 'top level',
        counts: { gear: 1, kits: 3 },
        data: { ...backup.data, gear: [{ ...lens, serialKey: '1834567' }], kits: [] },
      }),
    )
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return
    expect(result.value).not.toHaveProperty('extra')
    expect(result.value.counts).toEqual({ gear: 1 })
    expect(result.value.data).not.toHaveProperty('kits')
    expect(result.value.data.gear[0]).not.toHaveProperty('serialKey')
  })

  it('does not let a __proto__ key change other objects', () => {
    const text = withItem({}).replace('"id":', '"__proto__":{"polluted":true},"id":')
    expect(text).toContain('__proto__')
    expect(readBackup(text)).toMatchObject({ ok: true })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
