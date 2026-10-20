// Spend: what gear cost each calendar year, from purchases, maintenance, and sales. Each currency is
// totalled on its own, so no exchange rates are needed.
import type { IsoDate } from './dates'
import type { Gear } from './gear'
import type { MaintenanceFields } from './maintenance'
import { currencyOrder, DEFAULT_CURRENCY, type CurrencyCode, type Money } from './money'

export type SpendItem = Pick<
  Gear,
  'id' | 'status' | 'purchaseDate' | 'purchasePrice' | 'saleDate' | 'salePrice'
>

export type SpendRecord = Pick<MaintenanceFields, 'gearId' | 'date' | 'cost'>

/** One calendar year's spend in one currency, in minor units */
export interface YearSpend {
  readonly year: number
  readonly bought: number
  readonly maintenance: number
  readonly sold: number
  /** Bought plus maintenance, less sold, so it's below zero in a year that sold more */
  readonly net: number
}

export interface CurrencySpend {
  readonly currency: CurrencyCode
  /** Oldest first */
  readonly years: readonly YearSpend[]
  /** What items with no purchase date cost, in minor units, kept out of the years */
  readonly undatedBought: number
}

export interface Spend {
  readonly currencies: readonly CurrencySpend[]
  /** Priced items bought with no purchase date, which is what the undated groups hold */
  readonly undated: number
  /** Items bought with no purchase price, so the totals are partial */
  readonly unpriced: number
}

type Part = 'bought' | 'maintenance' | 'sold'

interface Tally {
  readonly years: Map<number, Record<Part, number>>
  undatedBought: number
}

const emptyRow = (): Record<Part, number> => ({ bought: 0, maintenance: 0, sold: 0 })

const yearOf = (date: IsoDate) => Number(date.slice(0, 4))

/**
 * Spend per currency and calendar year: everything bought except the wishlist (lost items
 * included) by purchase date, maintenance by the date the work was done (leaving out work on
 * wishlist items), and sales by sale date.
 */
export function spendByYear(
  items: Iterable<SpendItem>,
  records: Iterable<SpendRecord>,
  first: CurrencyCode = DEFAULT_CURRENCY,
): Spend {
  const tallies = new Map<CurrencyCode, Tally>()
  const tallyFor = (currency: CurrencyCode) => {
    let tally = tallies.get(currency)
    if (!tally) {
      tally = { years: new Map(), undatedBought: 0 }
      tallies.set(currency, tally)
    }
    return tally
  }
  const add = (part: Part, date: IsoDate, { amountMinor, currency }: Money) => {
    const { years } = tallyFor(currency)
    const year = yearOf(date)
    let row = years.get(year)
    if (!row) {
      row = emptyRow()
      years.set(year, row)
    }
    row[part] += amountMinor
  }

  let undated = 0
  let unpriced = 0
  const wishlist = new Set<string>()
  for (const { id, status, purchaseDate, purchasePrice, saleDate, salePrice } of items) {
    // Not bought yet. Lost items were, so they still count.
    if (status === 'wishlist') {
      wishlist.add(id)
      continue
    }
    if (purchasePrice === undefined) {
      unpriced += 1
    } else if (purchaseDate === undefined) {
      undated += 1
      tallyFor(purchasePrice.currency).undatedBought += purchasePrice.amountMinor
    } else {
      add('bought', purchaseDate, purchasePrice)
    }
    if (saleDate !== undefined && salePrice !== undefined) add('sold', saleDate, salePrice)
  }
  for (const { gearId, date, cost } of records) {
    if (cost !== undefined && !wishlist.has(gearId)) add('maintenance', date, cost)
  }

  const order = currencyOrder(first)
  const currencies = [...tallies]
    .sort(([a], [b]) => order(a, b))
    .map(([currency, tally]) => ({
      currency,
      years: yearRows(tally),
      undatedBought: tally.undatedBought,
    }))
  return { currencies, undated, unpriced }
}

/** Every year from the first to the last, including those with nothing spent */
function yearRows({ years }: Tally): YearSpend[] {
  if (years.size === 0) return []
  const from = Math.min(...years.keys())
  const to = Math.max(...years.keys())
  return Array.from({ length: to - from + 1 }, (_, index) => {
    const year = from + index
    const { bought, maintenance, sold } = years.get(year) ?? emptyRow()
    return { year, bought, maintenance, sold, net: bought + maintenance - sold }
  })
}
