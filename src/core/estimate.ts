// Estimated value: what an item is probably worth now. It loses the same share of its price every
// year, by whole and part years since it was bought, and never drops below a floor. There's no
// first-year drop, since Bodycap doesn't know whether it was bought new or used. Your own estimate,
// when you've given one, takes its place and doesn't decline. Each currency is totalled on its own.
import { daysBetween, isIsoDate, type IsoDate } from './dates'
import { isHeld, type Category, type Gear } from './gear'
import { DEFAULT_CURRENCY, sumByCurrency, type CurrencyCode, type Money } from './money'

export interface EstimateRate {
  /** The share of its value an item loses each year, such as 0.12 */
  readonly yearly: number
  /** The share of the price it never drops below, or 0 for none */
  readonly floor: number
}

// Each rate matches what resale prices suggest an item keeps after 10 years. Bodies and lenses are
// the best known; the rest are rougher.
const BODY = { yearly: 0.12, floor: 0.1 }
const LENS = { yearly: 0.08, floor: 0.1 }
const FLASH_OR_DRONE = { yearly: 0.14, floor: 0.1 }
const KIT = { yearly: 0.1, floor: 0.1 }
const CONSUMABLE = { yearly: 0.3, floor: 0 }

export const ESTIMATE_RATES: Record<Category, EstimateRate> = {
  'camera-body': BODY,
  lens: LENS,
  flash: FLASH_OR_DRONE,
  drone: FLASH_OR_DRONE,
  tripod: KIT,
  bag: KIT,
  filter: KIT,
  'mount-adapter': KIT,
  accessory: KIT,
  other: KIT,
  'memory-card': CONSUMABLE,
  battery: CONSUMABLE,
}

export type EstimateItem = Pick<
  Gear,
  'category' | 'purchaseDate' | 'purchasePrice' | 'ownEstimate' | 'ownEstimateDate'
>

export type Estimate =
  | { readonly value: Money; readonly source: 'worked-out' }
  | { readonly value: Money; readonly source: 'own'; readonly setOn: IsoDate }

/** The same day `years` later, with 29 February becoming 28 February in other years */
function anniversary(date: IsoDate, years: number): IsoDate {
  const year = String(Number(date.slice(0, 4)) + years).padStart(4, '0')
  const monthDay = date.slice(4)
  const same = `${year}${monthDay}`
  return isIsoDate(same) ? same : `${year}-02-28`
}

/** Whole years since `from`, plus the part of the year after the last anniversary */
function yearsSince(from: IsoDate, today: IsoDate): number {
  if (today <= from) return 0
  let whole = Number(today.slice(0, 4)) - Number(from.slice(0, 4))
  if (anniversary(from, whole) > today) whole -= 1
  const last = anniversary(from, whole)
  const next = anniversary(from, whole + 1)
  return whole + daysBetween(last, today) / daysBetween(last, next)
}

/**
 * What an item is probably worth on `today`: your own estimate if there is one, or else worked out
 * from its price, purchase date, and category. Undefined when there's nothing to work it out from.
 */
export function estimateValue(item: EstimateItem, today: IsoDate): Estimate | undefined {
  const { category, purchaseDate, purchasePrice, ownEstimate, ownEstimateDate } = item
  if (ownEstimate !== undefined && ownEstimateDate !== undefined) {
    return { value: ownEstimate, source: 'own', setOn: ownEstimateDate }
  }
  if (purchasePrice === undefined || purchaseDate === undefined) return undefined
  const { yearly, floor } = ESTIMATE_RATES[category]
  const share = Math.max((1 - yearly) ** yearsSince(purchaseDate, today), floor)
  return {
    value: {
      amountMinor: Math.round(purchasePrice.amountMinor * share),
      currency: purchasePrice.currency,
    },
    source: 'worked-out',
  }
}

export interface EstimatedItem<T> {
  readonly item: T
  readonly estimate: Estimate
}

export interface EstimateSummary<T> {
  /** Held items with an estimate, in the order given */
  readonly items: readonly EstimatedItem<T>[]
  /** Per currency, the `first` one leading */
  readonly totals: readonly Money[]
  /** Held items left out for having no price */
  readonly noPrice: number
  /** Held items left out for having a price but no purchase date */
  readonly noDate: number
}

/** Estimates every item you have (owned, lent out, or in repair) and totals them per currency. */
export function summariseEstimates<T extends EstimateItem & Pick<Gear, 'status'>>(
  items: Iterable<T>,
  today: IsoDate,
  first: CurrencyCode = DEFAULT_CURRENCY,
): EstimateSummary<T> {
  const estimated: EstimatedItem<T>[] = []
  let noPrice = 0
  let noDate = 0
  for (const item of items) {
    if (!isHeld(item.status)) continue
    const estimate = estimateValue(item, today)
    if (estimate !== undefined) estimated.push({ item, estimate })
    else if (item.purchasePrice === undefined) noPrice += 1
    else noDate += 1
  }
  return {
    items: estimated,
    totals: sumByCurrency(
      estimated.map(({ estimate }) => estimate.value),
      first,
    ),
    noPrice,
    noDate,
  }
}
