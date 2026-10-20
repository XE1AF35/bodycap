// Spend per calendar year and currency: what was bought, spent on maintenance, and sold, and the net.
import { describe, expect, it } from 'vitest'
import { spendByYear, type SpendItem } from '@/core/spend'

const nzd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'NZD' })
const usd = (dollars: number) => ({ amountMinor: dollars * 100, currency: 'USD' })

type Fields = Omit<SpendItem, 'id'>

/** Gives each item an ID by its place in the list: item-0, item-1, and so on */
const withIds = (list: readonly Fields[]): SpendItem[] =>
  list.map((fields, index) => ({ ...fields, id: `item-${String(index)}` }))

const year = (y: number, bought: number, maintenance = 0, sold = 0) => ({
  year: y,
  bought: bought * 100,
  maintenance: maintenance * 100,
  sold: sold * 100,
  net: (bought + maintenance - sold) * 100,
})

describe('spendByYear', () => {
  it('totals what was bought in each calendar year, by purchase date', () => {
    const items: Fields[] = [
      { status: 'owned', purchaseDate: '2025-01-01', purchasePrice: nzd(1000) },
      { status: 'owned', purchaseDate: '2025-12-31', purchasePrice: nzd(500) },
      { status: 'in-repair', purchaseDate: '2026-03-01', purchasePrice: nzd(200) },
    ]
    expect(spendByYear(withIds(items), [])).toEqual({
      currencies: [
        { currency: 'NZD', years: [year(2025, 1500), year(2026, 200)], undatedBought: 0 },
      ],
      undated: 0,
      unpriced: 0,
    })
  })

  it('counts maintenance in the year the work was done, and sales by sale date, for the net', () => {
    const items: Fields[] = [
      {
        status: 'sold',
        purchaseDate: '2023-06-01',
        purchasePrice: nzd(2000),
        saleDate: '2025-02-01',
        salePrice: nzd(1200),
      },
      { status: 'owned', purchaseDate: '2025-05-01', purchasePrice: nzd(900) },
    ]
    const records = [
      { gearId: 'item-0', date: '2024-04-01', cost: nzd(150) },
      { gearId: 'item-0', date: '2025-08-01', cost: nzd(100) },
      // Work with no cost adds nothing
      { gearId: 'item-0', date: '2025-09-01' },
    ]
    expect(spendByYear(withIds(items), records).currencies).toEqual([
      {
        currency: 'NZD',
        years: [year(2023, 2000), year(2024, 0, 150), year(2025, 900, 100, 1200)],
        undatedBought: 0,
      },
    ])
  })

  it('leaves the wishlist out but still counts what lost items cost', () => {
    const items: Fields[] = [
      { status: 'wishlist', purchasePrice: nzd(3000) },
      // Not a real state, but a wishlist item never counts, whatever it holds
      { status: 'wishlist', purchaseDate: '2026-01-01', purchasePrice: nzd(100) },
      { status: 'wishlist' },
      { status: 'lost', purchaseDate: '2026-02-01', purchasePrice: nzd(700) },
    ]
    expect(spendByYear(withIds(items), [])).toEqual({
      currencies: [{ currency: 'NZD', years: [year(2026, 700)], undatedBought: 0 }],
      undated: 0,
      unpriced: 0,
    })
  })

  it('leaves out maintenance on wishlist items, which were never bought', () => {
    const items: Fields[] = [
      { status: 'wishlist', purchasePrice: nzd(900) },
      { status: 'owned', purchaseDate: '2026-01-01', purchasePrice: nzd(500) },
    ]
    const records = [
      { gearId: 'item-0', date: '2026-02-01', cost: nzd(80) },
      { gearId: 'item-1', date: '2026-03-01', cost: nzd(60) },
    ]
    expect(spendByYear(withIds(items), records).currencies[0]?.years).toEqual([year(2026, 500, 60)])
  })

  it('keeps each currency apart, with the first currency leading and the rest alphabetical', () => {
    const items: Fields[] = [
      { status: 'owned', purchaseDate: '2026-01-01', purchasePrice: usd(500) },
      { status: 'owned', purchaseDate: '2026-02-01', purchasePrice: nzd(800) },
      {
        status: 'owned',
        purchaseDate: '2026-03-01',
        purchasePrice: { amountMinor: 90000, currency: 'JPY' },
      },
    ]
    const records = [{ gearId: 'item-0', date: '2026-04-01', cost: usd(50) }]
    const order = (first?: string) =>
      spendByYear(withIds(items), records, first).currencies.map(({ currency }) => currency)
    expect(order()).toEqual(['NZD', 'JPY', 'USD'])
    expect(order('USD')).toEqual(['USD', 'JPY', 'NZD'])
    expect(spendByYear(withIds(items), records, 'USD').currencies[0]).toEqual({
      currency: 'USD',
      years: [year(2026, 500, 50)],
      undatedBought: 0,
    })
  })

  it('totals items with no purchase date apart from the years, and counts items with no price', () => {
    const items: Fields[] = [
      { status: 'owned', purchasePrice: nzd(400) },
      { status: 'lent-out', purchasePrice: usd(250) },
      // Bought on a date nobody kept, but sold on a known one
      { status: 'sold', purchasePrice: nzd(600), saleDate: '2026-05-01', salePrice: nzd(300) },
      { status: 'owned', purchaseDate: '2026-06-01' },
      // No date and no price, so it's only unpriced: there's nothing to put in the undated group
      { status: 'lost' },
    ]
    expect(spendByYear(withIds(items), [])).toEqual({
      currencies: [
        { currency: 'NZD', years: [year(2026, 0, 0, 300)], undatedBought: 100000 },
        { currency: 'USD', years: [], undatedBought: 25000 },
      ],
      undated: 3,
      unpriced: 2,
    })
  })

  it('fills in the years with nothing spent between the first and the last, so none go missing', () => {
    const items: Fields[] = [
      { status: 'owned', purchaseDate: '2022-03-01', purchasePrice: nzd(100) },
      { status: 'owned', purchaseDate: '2025-03-01', purchasePrice: nzd(200) },
    ]
    expect(spendByYear(withIds(items), []).currencies[0]?.years).toEqual([
      year(2022, 100),
      year(2023, 0),
      year(2024, 0),
      year(2025, 200),
    ])
  })
})
