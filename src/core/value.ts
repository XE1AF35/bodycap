// What your gear adds up to. Each currency is totalled on its own, so no exchange rates are needed.
import { CATEGORIES, isHeld, type Category, type GearFields } from './gear'
import { DEFAULT_CURRENCY, sumByCurrency, type CurrencyCode, type Money } from './money'

/** Whether totals use what you paid or what the gear is insured for */
export type ValueBasis = 'purchase' | 'insured'

export type ValuedItem = Pick<GearFields, 'category' | 'status' | 'purchasePrice' | 'insuredValue'>

export interface CategoryTotals {
  readonly category: Category
  readonly totals: readonly Money[]
}

export interface ValueSummary {
  /** Gear you have, per currency */
  readonly totals: readonly Money[]
  /** The same split by category, in the usual category order, leaving out ones with no amounts */
  readonly byCategory: readonly CategoryTotals[]
  /** Gear you have with no amount on this basis, so the totals can be shown as partial */
  readonly unpriced: number
  /** What the wishlist would cost, from the prices you expect to pay */
  readonly wishlist: readonly Money[]
}

/** Totals gear you have (owned, lent out, or in repair), with the wishlist totalled apart. */
export function summariseValue(
  items: Iterable<ValuedItem>,
  basis: ValueBasis,
  first: CurrencyCode = DEFAULT_CURRENCY,
): ValueSummary {
  const held: Money[] = []
  const byCategory = new Map<Category, Money[]>()
  const wishlist: Money[] = []
  let unpriced = 0

  for (const item of items) {
    if (item.status === 'wishlist') {
      if (item.purchasePrice !== undefined) wishlist.push(item.purchasePrice)
      continue
    }
    if (!isHeld(item.status)) continue
    const amount = basis === 'purchase' ? item.purchasePrice : item.insuredValue
    if (amount === undefined) {
      unpriced += 1
      continue
    }
    held.push(amount)
    const inCategory = byCategory.get(item.category)
    if (inCategory) {
      inCategory.push(amount)
    } else {
      byCategory.set(item.category, [amount])
    }
  }

  return {
    totals: sumByCurrency(held, first),
    byCategory: CATEGORIES.flatMap((category) => {
      const amounts = byCategory.get(category)
      return amounts ? [{ category, totals: sumByCurrency(amounts, first) }] : []
    }),
    unpriced,
    wishlist: sumByCurrency(wishlist, first),
  }
}
