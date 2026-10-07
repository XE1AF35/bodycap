// The loan form's fields: who's borrowing it, how to reach them, when it went out, when it's due
// back, and notes. Used when lending an item and when editing its loan.
import type { LoanInput } from '@/core/loans'
import { DateField, NotesField, TextField } from '@/ui/gear/form/fields'
import type { LoanField } from './use-loan-form'

export function LoanFormFields({
  field,
}: {
  readonly field: (name: keyof LoanInput) => LoanField
}) {
  return (
    <>
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
    </>
  )
}
