// The loan form's state, shared by lending an item and editing its loan: what's typed, each field's
// message, and checking it all with the loan rules.
import { useState } from 'react'
import type { IsoDate } from '@/core/dates'
import { validateLoan, type LoanDetails, type LoanErrors, type LoanInput } from '@/core/loans'
import { focusFirst } from '@/ui/gear/status/change-props'

const FIELDS = ['borrower', 'contact', 'dateOut', 'dueDate', 'notes'] as const

/** What each field component needs */
export interface LoanField {
  readonly id: string
  readonly value: string
  readonly error: string | undefined
  readonly onChange: (value: string) => void
}

/** The form's state. `initial` fills it, at first and on each reset. */
export function useLoanForm(idPrefix: string, initial: () => LoanInput) {
  const [input, setInput] = useState(initial)
  const [errors, setErrors] = useState<LoanErrors>({})
  const fieldId = (name: keyof LoanInput) => `${idPrefix}-${name}`

  return {
    field: (name: keyof LoanInput): LoanField => ({
      id: fieldId(name),
      value: input[name],
      error: errors[name],
      onChange: (value) => {
        setInput((previous) => ({ ...previous, [name]: value }))
        // A field's message goes once it's changed
        setErrors((previous) => ({ ...previous, [name]: undefined }))
      },
    }),
    reset: () => {
      setInput(initial())
      setErrors({})
    },
    /** The loan's details, or nothing after showing what to fix and moving focus there */
    check: (today: IsoDate): LoanDetails | undefined => {
      const result = validateLoan(input, today)
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
