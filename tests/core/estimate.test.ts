// Estimated value: what an item is probably worth now, losing the same share every year down to a
// floor, unless you've given your own estimate.
import { describe, expect, it } from 'vitest'
import { estimateValue, summariseEstimates, type EstimateItem } from '@/core/estimate'
import type { Category } from '@/core/gear'

const TODAY = '2026-10-20'

const nzd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'NZD' })
const usd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'USD' })

const bought = (category: Category, purchaseDate: string, dollars = 1000): EstimateItem => ({
  category,
  purchaseDate,
  purchasePrice: nzd(dollars),
})

describe('estimateValue', () => {
  it('is what was paid on the day it was bought', () => {
    expect(estimateValue(bought('lens', TODAY), TODAY)).toEqual({
      value: nzd(1000),
      source: 'worked-out',
    })
  })

  it.each([
    ['camera-body', 880],
    ['lens', 920],
    ['flash', 860],
    ['drone', 860],
    ['tripod', 900],
    ['bag', 900],
    ['filter', 900],
    ['mount-adapter', 900],
    ['accessory', 900],
    ['other', 900],
    ['memory-card', 700],
    ['battery', 700],
  ] as const)('loses the yearly share for a %s after one year', (category, dollars) => {
    expect(estimateValue(bought(category, '2025-10-20'), TODAY)?.value).toEqual(nzd(dollars))
  })

  it('counts part years by the days since the last anniversary of the purchase', () => {
    // 183 of the 365 days to the first anniversary: about 0.94 of the price for a body
    expect(estimateValue(bought('camera-body', '2026-04-20', 2000), TODAY)?.value).toEqual({
      amountMinor: 187_584,
      currency: 'NZD',
    })
    // Bought later in the year than today, so not yet a whole year: 304 of 365 days
    expect(estimateValue(bought('lens', '2025-12-20'), TODAY)?.value).toEqual({
      amountMinor: 93_291,
      currency: 'NZD',
    })
    // Two whole years and the same part year
    expect(estimateValue(bought('lens', '2024-04-20'), TODAY)?.value).toEqual({
      amountMinor: 81_175,
      currency: 'NZD',
    })
  })

  it('is what was paid when the purchase date is after today, as a backup from a time zone ahead allows', () => {
    expect(estimateValue(bought('lens', '2026-10-21'), TODAY)?.value).toEqual(nzd(1000))
  })

  it('takes a 29 February purchase a whole year on at 28 February', () => {
    expect(estimateValue(bought('lens', '2024-02-29'), '2025-02-28')?.value).toEqual(nzd(920))
  })

  it('never drops below a tenth of the price', () => {
    // 0.88 to the 20th power is under 8%
    expect(estimateValue(bought('camera-body', '2006-10-20', 2000), TODAY)?.value).toEqual(nzd(200))
  })

  it('has no floor for memory cards and batteries, rounding to whole cents', () => {
    // 0.7 to the 20th power of $100 is 7.98 cents
    expect(estimateValue(bought('memory-card', '2006-10-20', 100), TODAY)?.value).toEqual({
      amountMinor: 8,
      currency: 'NZD',
    })
  })

  it('keeps the purchase currency', () => {
    const item = {
      ...bought('lens', TODAY),
      purchasePrice: { amountMinor: 150_000, currency: 'JPY' },
    }
    expect(estimateValue(item, TODAY)?.value).toEqual({ amountMinor: 150_000, currency: 'JPY' })
  })

  it('has nothing to work out from without a price or a purchase date', () => {
    expect(estimateValue({ category: 'lens', purchaseDate: '2025-01-01' }, TODAY)).toBeUndefined()
    expect(estimateValue({ category: 'lens', purchasePrice: nzd(1000) }, TODAY)).toBeUndefined()
  })

  it('uses your own estimate instead, which does not decline', () => {
    const item: EstimateItem = {
      ...bought('lens', '2016-10-20'),
      ownEstimate: nzd(1200),
      ownEstimateDate: '2020-01-01',
    }
    expect(estimateValue(item, TODAY)).toEqual({
      value: nzd(1200),
      source: 'own',
      setOn: '2020-01-01',
    })
  })

  it('uses your own estimate even with no price or purchase date', () => {
    const item: EstimateItem = {
      category: 'bag',
      ownEstimate: nzd(80),
      ownEstimateDate: '2026-10-01',
    }
    expect(estimateValue(item, TODAY)).toEqual({
      value: nzd(80),
      source: 'own',
      setOn: '2026-10-01',
    })
  })
})

describe('summariseEstimates', () => {
  const lens = { ...bought('lens', '2025-10-20'), status: 'owned' } as const

  it('totals held items per currency, with each item and its estimate', () => {
    const body = { ...bought('camera-body', '2025-10-20'), status: 'lent-out' } as const
    const flash = {
      ...bought('flash', '2025-10-20'),
      purchasePrice: usd(500),
      status: 'in-repair',
    } as const
    const bag = {
      category: 'bag',
      status: 'owned',
      ownEstimate: usd(60),
      ownEstimateDate: '2026-09-01',
    } as const
    expect(summariseEstimates([flash, lens, body, bag], TODAY)).toEqual({
      items: [
        { item: flash, estimate: { value: usd(430), source: 'worked-out' } },
        { item: lens, estimate: { value: nzd(920), source: 'worked-out' } },
        { item: body, estimate: { value: nzd(880), source: 'worked-out' } },
        { item: bag, estimate: { value: usd(60), source: 'own', setOn: '2026-09-01' } },
      ],
      totals: [nzd(1800), usd(490)],
      noPrice: 0,
      noDate: 0,
    })
  })

  it('leaves out gear you no longer have or have not bought', () => {
    const gone = (['sold', 'lost', 'wishlist'] as const).map((status) => ({ ...lens, status }))
    expect(summariseEstimates(gone, TODAY)).toEqual({
      items: [],
      totals: [],
      noPrice: 0,
      noDate: 0,
    })
  })

  it('counts held items with no price or no purchase date apart', () => {
    const summary = summariseEstimates(
      [
        lens,
        { category: 'lens', status: 'owned', purchaseDate: '2025-01-01' },
        { category: 'lens', status: 'owned' },
        { category: 'lens', status: 'owned', purchasePrice: nzd(500) },
      ],
      TODAY,
    )
    expect(summary.totals).toEqual([nzd(920)])
    expect(summary.noPrice).toBe(2)
    expect(summary.noDate).toBe(1)
  })

  it('puts the chosen currency first', () => {
    const other = { ...lens, purchasePrice: usd(1000) }
    expect(summariseEstimates([lens, other], TODAY, 'USD').totals).toEqual([usd(920), nzd(920)])
  })
})
