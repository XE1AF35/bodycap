// What every status change dialog is given by the status bar.
import type { IsoDate } from '@/core/dates'
import type { Gear, GearErrors } from '@/core/gear'
import { RuleError } from '@/data/repositories'

export interface ChangeProps {
  readonly item: Gear
  readonly today: IsoDate
  /** Closes the dialog after a change, saying what changed in the status bar's status line */
  readonly onDone: (message: string) => void
  /** Closes the dialog with nothing changed */
  readonly onCancel: () => void
}

/**
 * The messages for a dialog's own fields. Any others are about the item itself, such as a
 * purchase date that's now in the future, so they're thrown to show above the buttons.
 */
export function forFields<K extends keyof GearErrors>(
  errors: GearErrors,
  fields: readonly K[],
): Pick<GearErrors, K> {
  const others = Object.entries(errors).filter(
    ([field]) => !(fields as readonly string[]).includes(field),
  )
  if (others.length > 0) throw new RuleError(others.map(([, message]) => message).join(' '))
  return errors
}

/** Moves focus to the first field with a problem, so it's read out along with its message */
export function focusFirst(
  ids: readonly string[],
  errors: Readonly<Record<string, unknown>>,
): void {
  const id = ids.find((candidate) => errors[candidate] !== undefined)
  if (id !== undefined) document.getElementById(id)?.focus()
}
