// Lending an item: who has it, how to reach them, when it went out, and when it's due back. The
// loan and the item's new status are saved together.
import { useState } from 'react'
import { emptyLoanInput, validateLoan, type LoanErrors, type LoanInput } from '@/core/loans'
import { DateField, NotesField, TextField } from '@/ui/gear/form/fields'
import { gearName } from '@/ui/gear/labels'
import { useServices } from '@/ui/services'
import { focusFirst, type ChangeProps } from './change-props'
import { FormDialog } from './FormDialog'

const FIELDS = ['borrower', 'contact', 'dateOut', 'dueDate', 'notes'] as const
const fieldId = (field: keyof LoanInput) => `lend-${field}`

export function LendDialog({ item, today, finalFocus, onDone }: ChangeProps) {
  const { repositories } = useServices()
  const [input, setInput] = useState(() => emptyLoanInput(today))
  const [errors, setErrors] = useState<LoanErrors>({})

  const field = (name: keyof LoanInput) => ({
    id: fieldId(name),
    value: input[name],
    error: errors[name],
    onChange: (value: string) => {
      setInput((previous) => ({ ...previous, [name]: value }))
      setErrors((previous) => ({ ...previous, [name]: undefined }))
    },
  })

  return (
    <FormDialog
      trigger="Lend"
      title={`Lend ${gearName(item)}`}
      submit="Lend"
      finalFocus={finalFocus}
      onOpen={() => {
        setInput(emptyLoanInput(today))
        setErrors({})
      }}
      onSubmit={async () => {
        const result = validateLoan(input, today)
        if (!result.ok) {
          setErrors(result.error)
          focusFirst(
            FIELDS.map(fieldId),
            Object.fromEntries(FIELDS.map((name) => [fieldId(name), result.error[name]])),
          )
          return false
        }
        await repositories.loans.lend(item.id, result.value)
        onDone(`Lent to ${result.value.borrower}.`)
        return true
      }}
    >
      <TextField {...field('borrower')} label="Who's borrowing it" required />
      <TextField
        {...field('contact')}
        label="Contact"
        hint="A phone number or email, if you like."
      />
      <DateField {...field('dateOut')} label="Date it went out" />
      <DateField
        {...field('dueDate')}
        label="Due back"
        hint="Leave it blank if there's no set day."
      />
      <NotesField {...field('notes')} label="Notes" />
    </FormDialog>
  )
}
