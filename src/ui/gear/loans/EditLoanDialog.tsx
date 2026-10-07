// Editing the loan an item is out on, such as fixing a name or moving the due date.
import { useState } from 'react'
import type { IsoDate } from '@/core/dates'
import type { Gear } from '@/core/gear'
import { toLoanInput, type Loan } from '@/core/loans'
import { Button } from '@/ui/components/ui/button'
import { gearName } from '@/ui/gear/labels'
import { FormDialog } from '@/ui/gear/status/FormDialog'
import { useServices } from '@/ui/services'
import { LoanFormFields } from './LoanFormFields'
import { useLoanForm } from './use-loan-form'

interface EditLoanDialogProps {
  readonly item: Gear
  readonly loan: Loan
  readonly today: IsoDate
}

/** The form, open while it's rendered, starting from the loan as saved */
function EditLoanForm({
  item,
  loan,
  today,
  onClose,
}: EditLoanDialogProps & { readonly onClose: () => void }) {
  const { repositories } = useServices()
  const form = useLoanForm('edit-loan', () => toLoanInput(loan))
  return (
    <FormDialog
      title={`Edit the loan of ${gearName(item)}`}
      submit="Save"
      onCancel={onClose}
      onSubmit={async () => {
        const details = form.check(today)
        if (details === undefined) return
        await repositories.loans.update(loan.id, details)
        onClose()
      }}
    >
      <LoanFormFields field={form.field} />
    </FormDialog>
  )
}

export function EditLoanDialog(props: EditLoanDialogProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true)
        }}
      >
        Edit loan
      </Button>
      {open && (
        <EditLoanForm
          {...props}
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
