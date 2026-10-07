// Marking a lent item as back. With a loan recorded, the day it came back closes the loan as the
// item goes back to owned. Items marked lent out before loans were recorded just change status.
import { useState } from 'react'
import { formatDate } from '@/core/dates'
import { activeLoan, returnLoan, type Loan } from '@/core/loans'
import { RuleError } from '@/data/repositories'
import { DateField } from '@/ui/gear/form/fields'
import { gearName } from '@/ui/gear/labels'
import type { LiveState } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import type { ChangeProps } from './change-props'
import { FormDialog } from './FormDialog'
import { saveStatusChange } from './status-change'

const DATE_ID = 'return-date'

export function ReturnDialog({
  item,
  today,
  onDone,
  onCancel,
  loans,
}: ChangeProps & { readonly loans: LiveState<readonly Loan[]> }) {
  const { repositories } = useServices()
  const loan = loans.status === 'ready' ? activeLoan(loans.value, item.id) : undefined
  const [returnedOn, setReturnedOn] = useState(today)
  const [error, setError] = useState<string>()

  return (
    <FormDialog
      title={`${gearName(item)} is back`}
      description={
        loan === undefined
          ? "There's no loan recorded for it, so only its status changes."
          : `Lent to ${loan.borrower} on ${formatDate(loan.dateOut)}.`
      }
      submit="Mark as returned"
      returnFocus={false}
      ready={loans.status !== 'loading'}
      onCancel={onCancel}
      onSubmit={async () => {
        if (loan === undefined) {
          const errors = await saveStatusChange(repositories.gear, item, { to: 'owned' }, today)
          if (errors !== undefined) throw new RuleError(Object.values(errors).join(' '))
        } else {
          const checked = returnLoan(loan, returnedOn, today)
          if (!checked.ok) {
            setError(checked.error)
            document.getElementById(DATE_ID)?.focus()
            return
          }
          await repositories.loans.giveBack(loan.id, returnedOn)
        }
        onDone('Marked as returned.')
      }}
    >
      {loan !== undefined && (
        <DateField
          id={DATE_ID}
          label="Date it came back"
          value={returnedOn}
          error={error}
          onChange={(value) => {
            setReturnedOn(value)
            setError(undefined)
          }}
        />
      )}
    </FormDialog>
  )
}
