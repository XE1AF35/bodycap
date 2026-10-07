// What to tell the person when saving fails, in plain words, for every form and dialog that saves.
import { isStorageFull } from '@/data/storage'
import { GearNotFoundError, RecordNotFoundError, RuleError } from '@/data/repositories'

export function saveProblem(error: unknown): string {
  if (error instanceof GearNotFoundError) {
    return "This item was deleted, perhaps in another tab, so your changes weren't saved."
  }
  if (error instanceof RecordNotFoundError) {
    return `This ${error.kind} was deleted, perhaps in another tab, so your changes weren't saved.`
  }
  // Written for the person already, such as an item that can't be lent now
  if (error instanceof RuleError) return error.message
  if (isStorageFull(error)) {
    return "The browser has run out of space, so this wasn't saved. Free up some space, then try again."
  }
  return "This couldn't be saved. Try again."
}
