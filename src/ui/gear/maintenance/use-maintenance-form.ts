// The maintenance form's state, shared by logging new work and editing a record: what's typed, each
// field's message, and checking it all with the maintenance rules.
import { useState } from 'react'
import type { IsoDate } from '@/core/dates'
import type { MoneyInput } from '@/core/gear'
import {
  validateMaintenance,
  type MaintenanceDetails,
  type MaintenanceErrors,
  type MaintenanceInput,
} from '@/core/maintenance'
import { focusFirst } from '@/ui/gear/status/change-props'

const FIELDS = ['type', 'date', 'cost', 'provider', 'firmwareVersion', 'notes'] as const

type TextField = Exclude<keyof MaintenanceInput, 'cost'>

/** The form's state. `initial` fills it, at first and on each reset. */
export function useMaintenanceForm(idPrefix: string, initial: () => MaintenanceInput) {
  const [input, setInput] = useState(initial)
  const [errors, setErrors] = useState<MaintenanceErrors>({})
  const fieldId = (name: keyof MaintenanceInput) => `${idPrefix}-${name}`
  // A field's message goes once it's changed
  const clear = (name: keyof MaintenanceInput) => {
    setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  return {
    input,
    text: (name: TextField) => ({
      id: fieldId(name),
      value: input[name],
      error: errors[name],
      onChange: (value: string) => {
        setInput((previous) => ({ ...previous, [name]: value }))
        clear(name)
      },
    }),
    cost: {
      id: fieldId('cost'),
      value: input.cost,
      error: errors.cost,
      onChange: (value: MoneyInput) => {
        setInput((previous) => ({ ...previous, cost: value }))
        clear('cost')
      },
    },
    /** The record's details, or nothing after showing what to fix and moving focus there */
    check: (today: IsoDate): MaintenanceDetails | undefined => {
      const result = validateMaintenance(input, today)
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

export type MaintenanceForm = ReturnType<typeof useMaintenanceForm>
