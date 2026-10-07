// Lending an item: who has it, how to reach them, when it went out, and when it's due back. The
// loan and the item's new status are saved together.
import { emptyLoanInput } from '@/core/loans'
import { gearName } from '@/ui/gear/labels'
import { LoanFormFields } from '@/ui/gear/loans/LoanFormFields'
import { useLoanForm } from '@/ui/gear/loans/use-loan-form'
import { useServices } from '@/ui/services'
import type { ChangeProps } from './change-props'
import { FormDialog } from './FormDialog'

export function LendDialog({ item, today, onDone, onCancel }: ChangeProps) {
  const { repositories } = useServices()
  const form = useLoanForm('lend', () => emptyLoanInput(today))

  return (
    <FormDialog
      title={`Lend ${gearName(item)}`}
      submit="Lend"
      returnFocus={false}
      onCancel={onCancel}
      onSubmit={async () => {
        const details = form.check(today)
        if (details === undefined) return
        await repositories.loans.lend(item.id, details)
        onDone(`Lent to ${details.borrower}.`)
      }}
    >
      <LoanFormFields field={form.field} />
    </FormDialog>
  )
}
