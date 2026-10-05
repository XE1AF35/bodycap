// The gear lifecycle: which status changes make sense, and what each one records or clears.
import type { IsoDate } from './dates'
import {
  STATUS_LABELS,
  toGearInput,
  validateGear,
  type Gear,
  type GearErrors,
  type MoneyInput,
  type Status,
} from './gear'
import { err, ok, type Result } from './result'

// Only gear you have can be lent out, and a wishlist item has to be bought before anything else
const NEXT: Record<Status, readonly Status[]> = {
  wishlist: ['owned'],
  owned: ['lent-out', 'in-repair', 'sold', 'lost'],
  'lent-out': ['owned', 'lost'],
  'in-repair': ['owned', 'sold', 'lost'],
  sold: ['owned'],
  lost: ['owned'],
}

/** A new status, with the details selling or losing something needs, as typed into the form. */
export type StatusChange =
  | { readonly to: Exclude<Status, 'sold' | 'lost'> }
  | { readonly to: 'sold'; readonly saleDate: string; readonly salePrice: MoneyInput }
  | { readonly to: 'lost'; readonly lostDate: string }

/** Whether an item can go straight from one status to another. Staying put isn't a change. */
export function canChangeStatus(from: Status, to: Status): boolean {
  return NEXT[from].includes(to)
}

const named = (status: Status) => STATUS_LABELS[status].toLowerCase()

/**
 * Moves an item to a new status, dropping details that only fitted the old one, such as the sale
 * price when a sold item comes back. Errors are keyed like the form's fields. The caller saves the
 * result, which is when updatedAt changes.
 */
export function changeStatus(
  gear: Gear,
  change: StatusChange,
  today: IsoDate,
): Result<Gear, GearErrors> {
  const { to, ...details } = change
  if (to === gear.status) {
    return err({ status: 'Choose a different status.' })
  }
  if (!canChangeStatus(gear.status, to)) {
    return err({ status: `Can't change from ${named(gear.status)} to ${named(to)}.` })
  }
  // Going through validateGear keeps one set of rules for both edits and status changes
  const result = validateGear({ ...toGearInput(gear), ...details, status: to }, today)
  if (!result.ok) {
    return result
  }
  const { id, createdAt, updatedAt } = gear
  return ok({ id, createdAt, updatedAt, ...result.value })
}
