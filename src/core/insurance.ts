// The insurance list: the gear you have, with what an insurer asks about each item, and totals per
// currency. Gear lent out or in repair is still yours, so it's listed too.
import { CATEGORIES, isHeld, type Gear } from './gear'
import { DEFAULT_CURRENCY, type CurrencyCode, type Money } from './money'
import { filterAndSortGear } from './search'
import { summariseValue } from './value'

export interface InsuranceList<T extends Gear> {
  /** Bodies first, in the usual category order, and by name within each category */
  readonly items: readonly T[]
  /** What the items are insured for, per currency */
  readonly insured: readonly Money[]
  /** Items with no insured value, so the insured total can be shown as partial */
  readonly uninsured: number
  /** What the items cost, per currency */
  readonly paid: readonly Money[]
  /** Items with no purchase price */
  readonly unpriced: number
}

/** The insurance list for this gear, with the `first` currency leading each total */
export function insuranceList<T extends Gear>(
  gear: readonly T[],
  first: CurrencyCode = DEFAULT_CURRENCY,
): InsuranceList<T> {
  const held = gear.filter((item) => isHeld(item.status))
  const rank = (item: T) => CATEGORIES.indexOf(item.category)
  // Sorting is stable, so the name order holds within each category
  const items = filterAndSortGear(held, { sort: 'name' }).sort((a, b) => rank(a) - rank(b))
  const insured = summariseValue(held, 'insured', first)
  const paid = summariseValue(held, 'purchase', first)
  return {
    items,
    insured: insured.totals,
    uninsured: insured.unpriced,
    paid: paid.totals,
    unpriced: paid.unpriced,
  }
}
