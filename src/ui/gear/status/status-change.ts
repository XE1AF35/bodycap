// Saving a status change made with the item's buttons, through the same lifecycle rules as the form.
import type { IsoDate } from '@/core/dates'
import type { Gear, GearErrors } from '@/core/gear'
import { changeStatus, type StatusChange } from '@/core/lifecycle'
import type { GearRepository } from '@/data/repositories'

/** Saves the item at its new status, or gives the rule's messages, keyed like the form's fields */
export async function saveStatusChange(
  gear: GearRepository,
  item: Gear,
  change: StatusChange,
  today: IsoDate,
): Promise<GearErrors | undefined> {
  const result = changeStatus(item, change, today)
  if (!result.ok) return result.error
  await gear.update(item.id, result.value)
  return undefined
}
