// Dashboard alerts: warranty windows, backup reminders, storage space, duplicate serials, and
// overdue loans.
import { describe, expect, it } from 'vitest'
import {
  backupReminder,
  collectAlerts,
  expiringWarranties,
  storageNearlyFull,
  type AlertItem,
} from '@/core/alerts'
import { addDays } from '@/core/dates'
import type { Loan } from '@/core/loans'

const TODAY = '2026-10-05'
const daysFromToday = (days: number) => addDays(TODAY, days)

describe('expiringWarranties', () => {
  it.each([
    [-31, false],
    [-30, true],
    [-1, true],
    [0, true],
    [60, true],
    [61, false],
  ])('a warranty ending %i days from today is flagged: %s', (days, flagged) => {
    const item: AlertItem = {
      id: 'a',
      brand: 'Sony',
      status: 'owned',
      warrantyExpiry: daysFromToday(days),
    }
    expect(expiringWarranties([item], TODAY)).toEqual(
      flagged ? [{ id: 'a', warrantyExpiry: daysFromToday(days), daysLeft: days }] : [],
    )
  })

  it('covers gear you have, earliest first, and skips sold and lost gear', () => {
    const items: AlertItem[] = [
      { id: 'owned', brand: 'Sony', status: 'owned', warrantyExpiry: daysFromToday(40) },
      { id: 'lent', brand: 'Sony', status: 'lent-out', warrantyExpiry: daysFromToday(-10) },
      { id: 'repair', brand: 'Sony', status: 'in-repair', warrantyExpiry: daysFromToday(5) },
      { id: 'sold', brand: 'Sony', status: 'sold', warrantyExpiry: daysFromToday(5) },
      { id: 'lost', brand: 'Sony', status: 'lost', warrantyExpiry: daysFromToday(5) },
      { id: 'none', brand: 'Sony', status: 'owned' },
    ]
    expect(expiringWarranties(items, TODAY).map(({ id }) => id)).toEqual([
      'lent',
      'repair',
      'owned',
    ])
  })
})

describe('backupReminder', () => {
  it.each([
    ['never backed up, with changes', undefined, 1, { reason: 'never', changes: 1 }],
    ['never backed up, with nothing to back up', undefined, 0, undefined],
    ['backed up 13 days ago, 19 changes since', -13, 19, undefined],
    ['backed up 14 days ago, 1 change since', -14, 1, { reason: 'age', daysSince: 14, changes: 1 }],
    ['backed up 30 days ago, nothing changed since', -30, 0, undefined],
    [
      'backed up 2 days ago, 20 changes since',
      -2,
      20,
      { reason: 'changes', daysSince: 2, changes: 20 },
    ],
    [
      'backed up 30 days ago, 25 changes since',
      -30,
      25,
      { reason: 'changes', daysSince: 30, changes: 25 },
    ],
  ])('%s: %j', (_name, days, changes, reminder) => {
    const lastBackupOn = days === undefined ? undefined : daysFromToday(days)
    expect(backupReminder({ lastBackupOn, changesSinceBackup: changes }, TODAY)).toEqual(reminder)
  })

  it.each([
    ['a week, 8 days on', 7, -8, { reason: 'age', daysSince: 8, changes: 1 }],
    ['a week, 6 days on', 7, -6, undefined],
    ['a month, 20 days on', 30, -20, undefined],
    ['a month, 30 days on', 30, -30, { reason: 'age', daysSince: 30, changes: 1 }],
  ])('reminds after the number of days chosen: %s', (_name, dueDays, days, reminder) => {
    const state = { lastBackupOn: daysFromToday(days), changesSinceBackup: 1, dueDays }
    expect(backupReminder(state, TODAY)).toEqual(reminder)
  })
})

describe('storageNearlyFull', () => {
  it.each([
    [{ usage: 79, quota: 100 }, undefined],
    [{ usage: 80, quota: 100 }, 0.8],
    [{ usage: 100, quota: 100 }, 1],
    [{ usage: 50 }, undefined],
    [{ quota: 100 }, undefined],
    [{ usage: 0, quota: 0 }, undefined],
    [{}, undefined],
  ])('reports %j as %j', (estimate, usedFraction) => {
    expect(storageNearlyFull(estimate)).toBe(usedFraction)
  })
})

describe('collectAlerts', () => {
  const items: AlertItem[] = [
    { id: 'a', brand: 'Canon', status: 'owned', serialNumber: '01-234', warrantyExpiry: TODAY },
    { id: 'b', brand: 'Canon', status: 'sold', serialNumber: '01234' },
    { id: 'c', brand: 'Nikon', status: 'owned', warrantyExpiry: daysFromToday(-3) },
    { id: 'd', brand: 'Sony', status: 'lent-out' },
    { id: 'e', brand: 'Sony', status: 'lent-out' },
    { id: 'f', brand: 'Sony', status: 'lost' },
  ]

  const loan = (id: string, gearId: string, dueInDays: number, returnedOn?: string): Loan => ({
    id,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    gearId,
    borrower: `Borrower ${id}`,
    dateOut: '2026-09-01',
    dueDate: daysFromToday(dueInDays),
    ...(returnedOn === undefined ? {} : { returnedOn }),
  })

  const quiet = { lastBackupOn: TODAY, changesSinceBackup: 0 }

  it('lists backup, storage, overdue loan, warranty, and duplicate serial alerts in that order', () => {
    expect(
      collectAlerts(
        {
          items,
          loans: [loan('l1', 'd', -2)],
          backup: { changesSinceBackup: 3 },
          storage: { usage: 90, quota: 100, persisted: false },
        },
        TODAY,
      ),
    ).toEqual([
      { kind: 'backup', reason: 'never', changes: 3 },
      { kind: 'storage-nearly-full', usedFraction: 0.9 },
      { kind: 'storage-not-persisted' },
      {
        kind: 'overdue-loan',
        loanId: 'l1',
        gearId: 'd',
        borrower: 'Borrower l1',
        daysOverdue: 2,
      },
      { kind: 'warranty', id: 'c', warrantyExpiry: daysFromToday(-3), daysLeft: -3 },
      { kind: 'warranty', id: 'a', warrantyExpiry: TODAY, daysLeft: 0 },
      { kind: 'duplicate-serial', serialKey: '01234', ids: ['a', 'b'] },
    ])
  })

  it('flags loans past due for gear still lent out, the longest overdue first', () => {
    const loans = [
      loan('due-today', 'd', 0),
      loan('late', 'd', -2),
      loan('later', 'e', -9),
      loan('back', 'e', -20, daysFromToday(-15)),
      // Lost while lent, so chasing the loan won't help
      loan('lost', 'f', -30),
      loan('gone', 'z', -30),
    ]
    const alerts = collectAlerts({ items, loans, backup: quiet, storage: {} }, TODAY)
    expect(
      alerts.map((alert) => (alert.kind === 'overdue-loan' ? alert.loanId : alert.kind)),
    ).toEqual(['later', 'late', 'warranty', 'warranty', 'duplicate-serial'])
  })

  it('has nothing to say when all is well, or when the browser gives no storage details', () => {
    expect(collectAlerts({ items: [], loans: [], backup: quiet, storage: {} }, TODAY)).toEqual([])
    expect(
      collectAlerts(
        { items: [], loans: [], backup: quiet, storage: { usage: 1, quota: 100, persisted: true } },
        TODAY,
      ),
    ).toEqual([])
  })
})
