// Usage, worked out from the shoots log only: how often an item goes on shoots, and which held
// items haven't been on one in the past year, to help decide what to sell.
import { addDays, type IsoDate } from './dates'
import { isHeld, type Category, type Gear } from './gear'
import type { ShootFields } from './shoots'

export type UsageShoot = Pick<ShootFields, 'date' | 'gearIds'>

export interface Usage {
  /** How many shoots the item was on */
  readonly count: number
  /** The date of the latest of them, if there's been one */
  readonly lastUsed?: IsoDate
}

/** How many shoots an item was on, and the date of the latest */
export function usageOf(gearId: string, shoots: readonly UsageShoot[]): Usage {
  let count = 0
  let lastUsed: IsoDate | undefined
  for (const { date, gearIds } of shoots) {
    if (!gearIds.includes(gearId)) continue
    count += 1
    // Dates compare correctly as plain YYYY-MM-DD strings
    if (lastUsed === undefined || date > lastUsed) lastUsed = date
  }
  return { count, ...(lastUsed !== undefined ? { lastUsed } : {}) }
}

/**
 * The kinds of gear the unused list covers. Cards, batteries, bags, and the like aren't worth
 * selling on.
 */
export const UNUSED_CATEGORIES: readonly Category[] = ['camera-body', 'lens', 'flash', 'drone']

/** How far back "the past year" reaches, in days, counting today */
export const UNUSED_WINDOW_DAYS = 365

export interface UnusedItem<T> {
  readonly item: T
  readonly usage: Usage
}

/**
 * Held bodies, lenses, flashes, and drones that haven't been on a shoot in the past year: those
 * never on one first, then the longest unused. Based only on the shoots logged.
 */
export function unusedItems<T extends Pick<Gear, 'id' | 'category' | 'status'>>(
  items: readonly T[],
  shoots: readonly UsageShoot[],
  today: IsoDate,
): UnusedItem<T>[] {
  const since = addDays(today, -UNUSED_WINDOW_DAYS)
  return (
    items
      .filter(({ category, status }) => UNUSED_CATEGORIES.includes(category) && isHeld(status))
      .map((item) => ({ item, usage: usageOf(item.id, shoots) }))
      .filter(({ usage }) => usage.lastUsed === undefined || usage.lastUsed < since)
      // An empty string sorts before every date, so items never used come first
      .sort((a, b) => (a.usage.lastUsed ?? '').localeCompare(b.usage.lastUsed ?? ''))
  )
}
