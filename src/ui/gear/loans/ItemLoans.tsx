// An item's loans on its page: the one it's out on, with how to reach the borrower and when it's due
// back, flagged once it's overdue, and the loans before it. Nothing shows for an item never lent.
import { useId, useMemo, useState } from 'react'
import { formatDate, toIsoDate } from '@/core/dates'
import type { Gear } from '@/core/gear'
import { activeLoan, daysOverdue, type Loan } from '@/core/loans'
import { Readout } from '@/ui/components/Readout'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { EditLoanDialog } from './EditLoanDialog'
import { overdueText } from './words'

type ReturnedLoan = Loan & { readonly returnedOn: string }

export function ItemLoans({ item }: { readonly item: Gear }) {
  const { repositories } = useServices()
  const loans = useLive(useMemo(() => repositories.loans.forGear(item.id), [repositories, item.id]))
  // Read once, which is close enough for loans counted in days
  const [today] = useState(() => toIsoDate(new Date()))
  const currentId = useId()
  const earlierId = useId()
  if (loans.status !== 'ready') return null

  const loan = activeLoan(loans.value, item.id)
  // Valid dates sort correctly as plain YYYY-MM-DD strings
  const earlier = loans.value
    .filter((past): past is ReturnedLoan => past.returnedOn !== undefined)
    .sort((a, b) => b.dateOut.localeCompare(a.dateOut))
  const late = loan === undefined ? 0 : daysOverdue(loan, today)

  return (
    <>
      {loan !== undefined && (
        <section
          aria-labelledby={currentId}
          className="mb-8 rounded-lg border border-border bg-card p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id={currentId} className="text-base font-semibold">
              On loan to {loan.borrower}
            </h2>
            <EditLoanDialog item={item} loan={loan} today={today} />
          </div>
          {late > 0 && (
            <p className="mb-3 flex items-center gap-2 text-sm font-medium">
              <span className="size-2 shrink-0 rounded-full bg-signal" />
              {overdueText(late)}
            </p>
          )}
          <Readout
            rows={[
              { label: 'Contact', value: loan.contact },
              { label: 'Went out', value: formatDate(loan.dateOut), data: true },
              {
                label: 'Due back',
                value: loan.dueDate === undefined ? 'No set day' : formatDate(loan.dueDate),
                data: loan.dueDate !== undefined,
              },
              { label: 'Notes', value: loan.notes },
            ]}
          />
        </section>
      )}
      {earlier.length > 0 && (
        <section aria-labelledby={earlierId} className="mb-8">
          <h2 id={earlierId} className="mb-3 text-base font-semibold">
            Earlier loans
          </h2>
          <ul className="grid gap-1 text-sm">
            {earlier.map((past) => (
              <li key={past.id}>
                {`${past.borrower}, `}
                <span className="font-mono">{formatDate(past.dateOut)}</span>
                {' to '}
                <span className="font-mono">{formatDate(past.returnedOn)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
