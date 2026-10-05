// Gear lifecycle: which status changes are allowed, and what each change records or clears.
import { describe, expect, it } from 'vitest'
import { STATUSES, type Gear, type Status } from '@/core/gear'
import { canChangeStatus, changeStatus, type StatusChange } from '@/core/lifecycle'

const TODAY = '2026-10-05'

// Written out here rather than shared with the code, so a slip in either one shows up
const ALLOWED: Record<Status, readonly Status[]> = {
  wishlist: ['owned'],
  owned: ['lent-out', 'in-repair', 'sold', 'lost'],
  'lent-out': ['owned', 'lost'],
  'in-repair': ['owned', 'sold', 'lost'],
  sold: ['owned'],
  lost: ['owned'],
}

const everyChange = STATUSES.flatMap((from) =>
  STATUSES.map((to) => [from, to, ALLOWED[from].includes(to) ? 'allowed' : 'refused'] as const),
)

/** An owned lens bought in March, with the fields under test overridden */
const lens = (overrides: Partial<Gear> = {}): Gear => ({
  id: '6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90',
  createdAt: '2026-03-02T01:00:00.000Z',
  updatedAt: '2026-03-02T01:00:00.000Z',
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  serialNumber: '1834567',
  mount: 'sony-e',
  lensCoverage: 'full-frame',
  purchaseDate: '2026-03-01',
  purchasePrice: { amountMinor: 389900, currency: 'NZD' },
  status: 'owned',
  ...overrides,
})

const nzd = (amount: string) => ({ amount, currency: 'NZD' })

describe('canChangeStatus', () => {
  it.each(everyChange)('%s to %s is %s', (from, to, verdict) => {
    expect(canChangeStatus(from, to)).toBe(verdict === 'allowed')
  })
})

describe('changeStatus', () => {
  it.each([
    ['owned', 'lent-out'],
    ['owned', 'in-repair'],
    ['lent-out', 'owned'],
    ['in-repair', 'owned'],
  ] as const)('moves a %s item to %s and keeps everything else', (from, to) => {
    expect(changeStatus(lens({ status: from }), { to }, TODAY)).toEqual({
      ok: true,
      value: lens({ status: to }),
    })
  })

  it.each(['owned', 'in-repair'] as const)('records the sale of a %s item', (from) => {
    const change = { to: 'sold', saleDate: '2026-09-20', salePrice: nzd('2,950') } as const
    expect(changeStatus(lens({ status: from }), change, TODAY)).toEqual({
      ok: true,
      value: lens({
        status: 'sold',
        saleDate: '2026-09-20',
        salePrice: { amountMinor: 295000, currency: 'NZD' },
      }),
    })
  })

  it.each(['owned', 'lent-out', 'in-repair'] as const)(
    'records the date a %s item was lost',
    (from) => {
      const change = { to: 'lost', lostDate: '2026-09-20' } as const
      expect(changeStatus(lens({ status: from }), change, TODAY)).toEqual({
        ok: true,
        value: lens({ status: 'lost', lostDate: '2026-09-20' }),
      })
    },
  )

  it('turns a wishlist item into an owned one, keeping its price and shop', () => {
    const wanted: Gear = {
      id: '0b7e2d14-8c3a-4e6f-a1d9-2f5c8b3e7a60',
      createdAt: '2026-08-11T22:30:00.000Z',
      updatedAt: '2026-08-11T22:30:00.000Z',
      category: 'camera-body',
      brand: 'Fujifilm',
      model: 'X-T5',
      mount: 'fujifilm-x',
      sensorFormat: 'aps-c',
      purchasePrice: { amountMinor: 299900, currency: 'NZD' },
      whereBought: 'Wellington Camera Store',
      status: 'wishlist',
    }
    expect(changeStatus(wanted, { to: 'owned' }, TODAY)).toEqual({
      ok: true,
      value: { ...wanted, status: 'owned' },
    })
  })

  it('clears the sale details when a sold item comes back', () => {
    const sold = lens({
      status: 'sold',
      saleDate: '2026-09-20',
      salePrice: { amountMinor: 295000, currency: 'NZD' },
    })
    expect(changeStatus(sold, { to: 'owned' }, TODAY)).toEqual({ ok: true, value: lens() })
    expect(sold.status).toBe('sold')
  })

  it('clears the date it was lost when a lost item is found', () => {
    const lost = lens({ status: 'lost', lostDate: '2026-09-20' })
    expect(changeStatus(lost, { to: 'owned' }, TODAY)).toEqual({ ok: true, value: lens() })
  })

  it.each<[Status, StatusChange, string]>([
    ['sold', { to: 'lent-out' }, "Can't change from sold to lent out."],
    ['lost', { to: 'lent-out' }, "Can't change from lost to lent out."],
    ['wishlist', { to: 'lent-out' }, "Can't change from wishlist to lent out."],
    [
      'wishlist',
      { to: 'sold', saleDate: '2026-09-20', salePrice: nzd('100') },
      "Can't change from wishlist to sold.",
    ],
    ['owned', { to: 'wishlist' }, "Can't change from owned to wishlist."],
    ['lent-out', { to: 'in-repair' }, "Can't change from lent out to in repair."],
    ['owned', { to: 'owned' }, 'Choose a different status.'],
  ])('refuses to change a %s item with %j: %s', (from, change, message) => {
    expect(changeStatus(lens({ status: from }), change, TODAY)).toEqual({
      ok: false,
      error: { status: message },
    })
  })

  it('needs the sale date and price', () => {
    const change = { to: 'sold', saleDate: ' ', salePrice: nzd('') } as const
    expect(changeStatus(lens(), change, TODAY)).toEqual({
      ok: false,
      error: { saleDate: 'Enter the date it was sold.', salePrice: 'Enter what it sold for.' },
    })
  })

  it.each<[StatusChange, string, string]>([
    [
      { to: 'sold', saleDate: '2026-10-06', salePrice: nzd('900') },
      'saleDate',
      "The sale date can't be in the future.",
    ],
    [
      { to: 'sold', saleDate: '2026-02-28', salePrice: nzd('900') },
      'saleDate',
      "The sale date can't be before the purchase date.",
    ],
    [
      { to: 'sold', saleDate: '2026-09-20', salePrice: nzd('-900') },
      'salePrice',
      "Amounts can't be negative.",
    ],
    [{ to: 'lost', lostDate: '' }, 'lostDate', 'Enter the date it was lost.'],
    [{ to: 'lost', lostDate: '2026-02-30' }, 'lostDate', 'Enter a real date.'],
    [
      { to: 'lost', lostDate: '2026-02-28' },
      'lostDate',
      "It can't have been lost before the purchase date.",
    ],
  ])('checks the details of %j, reporting on %s: %s', (change, field, message) => {
    expect(changeStatus(lens(), change, TODAY)).toEqual({
      ok: false,
      error: { [field]: message },
    })
  })
})
