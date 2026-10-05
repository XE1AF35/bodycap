// Value totals: gear you have per currency and category, the wishlist apart, and unpriced items.
import { describe, expect, it } from 'vitest'
import { summariseValue, type ValuedItem } from '@/core/value'

const nzd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'NZD' })
const usd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'USD' })

const items: ValuedItem[] = [
  { category: 'lens', status: 'owned', purchasePrice: nzd(2000), insuredValue: nzd(2200) },
  { category: 'camera-body', status: 'lent-out', purchasePrice: usd(1500) },
  { category: 'lens', status: 'in-repair', purchasePrice: usd(800), insuredValue: nzd(1000) },
  { category: 'bag', status: 'owned', insuredValue: nzd(300) },
  { category: 'lens', status: 'sold', purchasePrice: nzd(900) },
  { category: 'flash', status: 'lost', purchasePrice: nzd(400) },
  { category: 'drone', status: 'wishlist', purchasePrice: nzd(1800) },
  { category: 'lens', status: 'wishlist', purchasePrice: usd(1200) },
  { category: 'filter', status: 'wishlist' },
]

describe('summariseValue', () => {
  it('totals what you paid for gear you have, per currency and per category', () => {
    expect(summariseValue(items, 'purchase')).toEqual({
      totals: [nzd(2000), usd(2300)],
      byCategory: [
        { category: 'camera-body', totals: [usd(1500)] },
        { category: 'lens', totals: [nzd(2000), usd(800)] },
      ],
      unpriced: 1,
      wishlist: [nzd(1800), usd(1200)],
    })
  })

  it('totals insured values instead, still pricing the wishlist by what you expect to pay', () => {
    expect(summariseValue(items, 'insured')).toEqual({
      totals: [nzd(3500)],
      byCategory: [
        { category: 'lens', totals: [nzd(3200)] },
        { category: 'bag', totals: [nzd(300)] },
      ],
      unpriced: 1,
      wishlist: [nzd(1800), usd(1200)],
    })
  })

  it('can list another currency first', () => {
    expect(summariseValue(items, 'purchase', 'USD').totals).toEqual([usd(2300), nzd(2000)])
  })

  it('counts a price of zero, such as a gift, as priced', () => {
    const gift: ValuedItem = { category: 'tripod', status: 'owned', purchasePrice: nzd(0) }
    expect(summariseValue([gift], 'purchase')).toMatchObject({ totals: [nzd(0)], unpriced: 0 })
  })

  it('has nothing to total for no gear', () => {
    expect(summariseValue([], 'purchase')).toEqual({
      totals: [],
      byCategory: [],
      unpriced: 0,
      wishlist: [],
    })
  })
})
