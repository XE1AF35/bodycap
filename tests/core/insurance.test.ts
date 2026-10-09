// The insurance list: gear you have (owned, lent out, or in repair), bodies first and by name within
// each category, with totals of insured values and prices paid per currency.
import { describe, expect, it } from 'vitest'
import type { Gear, Status } from '@/core/gear'
import { insuranceList } from '@/core/insurance'

const item = (id: string, fields: Partial<Gear> = {}): Gear => ({
  id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  category: 'lens',
  brand: 'Fujifilm',
  model: 'XF 35mm F1.4 R',
  status: 'owned',
  ...fields,
})

const ids = (list: readonly Gear[]) => list.map(({ id }) => id)

describe('insuranceList', () => {
  it.each<Status>(['owned', 'lent-out', 'in-repair'])('lists gear that is %s', (status) => {
    expect(ids(insuranceList([item('a', { status })]).items)).toEqual(['a'])
  })

  it.each<Status>(['wishlist', 'sold', 'lost'])('leaves out gear that is %s', (status) => {
    expect(insuranceList([item('a', { status })]).items).toEqual([])
  })

  it('puts bodies first, in category order, then sorts by name with numbers in order', () => {
    const gear = [
      item('flash', { category: 'flash', brand: 'Godox', model: 'V1' }),
      item('long', { model: 'XF 100-400mm' }),
      item('wide', { model: 'XF 16mm F1.4' }),
      item('body', { category: 'camera-body', model: 'X-T5' }),
    ]
    expect(ids(insuranceList(gear).items)).toEqual(['body', 'wide', 'long', 'flash'])
  })

  it('totals insured values and prices paid per currency, NZD first', () => {
    const gear = [
      item('a', {
        purchasePrice: { amountMinor: 150000, currency: 'NZD' },
        insuredValue: { amountMinor: 160000, currency: 'NZD' },
      }),
      item('b', {
        purchasePrice: { amountMinor: 900, currency: 'USD' },
        insuredValue: { amountMinor: 120000, currency: 'NZD' },
      }),
      item('c', { purchasePrice: { amountMinor: 50000, currency: 'AUD' } }),
      item('d', {
        status: 'sold',
        insuredValue: { amountMinor: 999999, currency: 'NZD' },
      }),
    ]
    expect(insuranceList(gear)).toMatchObject({
      insured: [{ amountMinor: 280000, currency: 'NZD' }],
      uninsured: 1,
      paid: [
        { amountMinor: 150000, currency: 'NZD' },
        { amountMinor: 50000, currency: 'AUD' },
        { amountMinor: 900, currency: 'USD' },
      ],
      unpriced: 0,
    })
  })

  it('leads the totals with the currency asked for', () => {
    const gear = [
      item('a', { insuredValue: { amountMinor: 1000, currency: 'NZD' } }),
      item('b', { insuredValue: { amountMinor: 2000, currency: 'AUD' } }),
    ]
    expect(insuranceList(gear, 'AUD').insured.map(({ currency }) => currency)).toEqual([
      'AUD',
      'NZD',
    ])
  })

  it('has nothing to list or total when there is no gear', () => {
    expect(insuranceList([])).toEqual({
      items: [],
      insured: [],
      uninsured: 0,
      paid: [],
      unpriced: 0,
    })
  })
})
