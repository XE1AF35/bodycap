// The maintenance log: the kinds of work, checking a record as typed, and an item's history.
import { describe, expect, it } from 'vitest'
import {
  emptyMaintenanceInput,
  lastDone,
  MAINTENANCE_TYPE_LABELS,
  MAINTENANCE_TYPES,
  maintenanceHistory,
  toMaintenanceInput,
  validateMaintenance,
  type MaintenanceDetails,
  type MaintenanceInput,
  type MaintenanceRecord,
} from '@/core/maintenance'
import { err, ok } from '@/core/result'

const TODAY = '2026-10-07'

const typed = (fields: Partial<MaintenanceInput>): MaintenanceInput => ({
  ...emptyMaintenanceInput(TODAY, 'NZD'),
  type: 'sensor-clean',
  ...fields,
})

let ids = 0
const record = (fields: Partial<MaintenanceRecord>): MaintenanceRecord => {
  ids += 1
  return {
    id: `record-${String(ids)}`,
    gearId: 'gear-1',
    type: 'sensor-clean',
    date: '2026-01-10',
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-01-10T09:00:00.000Z',
    ...fields,
  }
}

describe('maintenance types', () => {
  it('has unique types, each with a label', () => {
    expect(new Set(MAINTENANCE_TYPES).size).toBe(MAINTENANCE_TYPES.length)
    for (const type of MAINTENANCE_TYPES) expect(MAINTENANCE_TYPE_LABELS[type], type).toBeTruthy()
  })
})

describe('emptyMaintenanceInput', () => {
  it('starts on today, with the cost in the currency given', () => {
    expect(emptyMaintenanceInput(TODAY, 'AUD')).toEqual({
      type: '',
      date: TODAY,
      cost: { amount: '', currency: 'AUD' },
      provider: '',
      firmwareVersion: '',
      notes: '',
    })
  })
})

describe('validateMaintenance', () => {
  it.each<[string, Partial<MaintenanceInput>, MaintenanceDetails]>([
    ['what was done and when', {}, { type: 'sensor-clean', date: TODAY }],
    [
      'every detail of a firmware update, tidied',
      {
        type: 'firmware-update',
        date: '2026-09-30',
        cost: { amount: '0', currency: 'NZD' },
        provider: '  Done at home ',
        firmwareVersion: ' 2.10 ',
        notes: 'Fixes the eye detection bug.\r\nNo settings lost.',
      },
      {
        type: 'firmware-update',
        date: '2026-09-30',
        cost: { amountMinor: 0, currency: 'NZD' },
        provider: 'Done at home',
        firmwareVersion: '2.10',
        notes: 'Fixes the eye detection bug.\nNo settings lost.',
      },
    ],
    [
      'a repair paid for in another currency',
      { type: 'repair', cost: { amount: '349.95', currency: 'AUD' }, provider: 'Canon Australia' },
      {
        type: 'repair',
        date: TODAY,
        cost: { amountMinor: 34995, currency: 'AUD' },
        provider: 'Canon Australia',
      },
    ],
    [
      'only the work, leaving out a firmware version left over from another type',
      { type: 'repair', firmwareVersion: '1.2' },
      { type: 'repair', date: TODAY },
    ],
  ])('reads %s', (_name, fields, expected) => {
    expect(validateMaintenance(typed(fields), TODAY)).toEqual(ok(expected))
  })

  it.each<[Partial<MaintenanceInput>, keyof MaintenanceInput, string]>([
    [{ type: '' }, 'type', 'Choose what was done.'],
    [{ type: 'polish' }, 'type', 'Choose what was done.'],
    [{ date: '' }, 'date', 'Enter the date it was done.'],
    [{ date: '2026-02-30' }, 'date', 'Enter a real date.'],
    [{ date: '2026-10-08' }, 'date', "The date can't be in the future."],
    [{ cost: { amount: '10', currency: 'NOPE' } }, 'cost', 'Choose a currency.'],
    [{ provider: 'a'.repeat(121) }, 'provider', 'Keep who did it to 120 characters or fewer.'],
    [
      { type: 'firmware-update', firmwareVersion: 'a'.repeat(41) },
      'firmwareVersion',
      'Keep the firmware version to 40 characters or fewer.',
    ],
    [{ notes: 'a'.repeat(2001) }, 'notes', 'Keep the notes to 2,000 characters or fewer.'],
  ])('turns down %o, saying what to fix in %s', (fields, field, message) => {
    expect(validateMaintenance(typed(fields), TODAY)).toMatchObject({
      ok: false,
      error: { [field]: message },
    })
  })

  it('reports every problem at once', () => {
    expect(validateMaintenance(typed({ type: '', date: '' }), TODAY)).toEqual(
      err({ type: 'Choose what was done.', date: 'Enter the date it was done.' }),
    )
  })
})

describe('toMaintenanceInput', () => {
  it.each<MaintenanceDetails>([
    { type: 'sensor-clean', date: '2026-01-10' },
    {
      type: 'firmware-update',
      date: '2026-09-30',
      cost: { amountMinor: 34995, currency: 'AUD' },
      provider: 'Canon Australia',
      firmwareVersion: '2.10',
      notes: 'Two\nlines',
    },
  ])('fills the form so that saving %o unchanged gives it back exactly', (details) => {
    expect(validateMaintenance(toMaintenanceInput(details, 'NZD'), TODAY)).toEqual(ok(details))
  })

  it('starts a blank cost in the currency given', () => {
    expect(toMaintenanceInput({ type: 'repair', date: TODAY }, 'GBP').cost).toEqual({
      amount: '',
      currency: 'GBP',
    })
  })
})

describe("an item's history", () => {
  const older = record({ date: '2025-11-02' })
  const firmware = record({ type: 'firmware-update', date: '2026-09-30' })
  const newer = record({ date: '2026-05-20' })
  const sameDay = record({ type: 'repair', date: '2026-05-20' })
  const otherItem = record({ gearId: 'gear-2', date: '2026-10-01' })
  const records = [older, firmware, newer, otherItem, sameDay]

  it("lists only that item's records, most recent first", () => {
    expect(maintenanceHistory(records, 'gear-1')).toEqual([firmware, newer, sameDay, older])
  })

  it('finds the most recent work of one type, such as the last sensor clean', () => {
    expect(lastDone(records, 'gear-1', 'sensor-clean')).toBe(newer)
    expect(lastDone(records, 'gear-2', 'firmware-update')).toBeUndefined()
  })
})
