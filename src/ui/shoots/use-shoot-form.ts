// The shoot form's state: what's typed, the items ticked, each field's message, and checking it all
// with the shoot rules.
import { useState } from 'react'
import type { IsoDate } from '@/core/dates'
import { validateShoot, type ShootErrors, type ShootFields, type ShootInput } from '@/core/shoots'
import { focusFirst } from '@/ui/gear/status/change-props'

const FIELDS = ['date', 'name', 'notes'] as const

type TextField = (typeof FIELDS)[number]

/** The form's state. `initial` fills it. */
export function useShootForm(idPrefix: string, initial: () => ShootInput) {
  const [input, setInput] = useState(initial)
  const [errors, setErrors] = useState<ShootErrors>({})
  const fieldId = (name: TextField) => `${idPrefix}-${name}`

  return {
    text: (name: TextField) => ({
      id: fieldId(name),
      value: input[name],
      error: errors[name],
      onChange: (value: string) => {
        setInput((previous) => ({ ...previous, [name]: value }))
        // A field's message goes once it's changed
        setErrors((previous) => ({ ...previous, [name]: undefined }))
      },
    }),
    gearIds: new Set(input.gearIds) as ReadonlySet<string>,
    setGearIds: (chosen: ReadonlySet<string>) => {
      setInput((previous) => ({ ...previous, gearIds: [...chosen] }))
    },
    /** The shoot's fields, or nothing after showing what to fix and moving focus there */
    check: (today: IsoDate): ShootFields | undefined => {
      const result = validateShoot(input, today)
      if (result.ok) return result.value
      setErrors(result.error)
      focusFirst(
        FIELDS.map(fieldId),
        Object.fromEntries(FIELDS.map((name) => [fieldId(name), result.error[name]])),
      )
      return undefined
    },
  }
}
