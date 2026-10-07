// Everything lent out right now, with who has it and when it's due back, the longest overdue first.
// An item lost while lent isn't listed, since it isn't coming back from the borrower.
import { Link } from '@tanstack/react-router'
import { formatDate, type IsoDate } from '@/core/dates'
import type { Gear } from '@/core/gear'
import { daysOverdue, type Loan } from '@/core/loans'
import { gearName } from '@/ui/gear/labels'
import { overdueText } from '@/ui/gear/loans/words'

interface OnLoanProps {
  readonly loans: readonly Loan[]
  readonly items: readonly Gear[]
  readonly today: IsoDate
}

// Sorting by due date puts the longest overdue first, then the soonest due, and open-ended last
const NO_DUE_DATE = '9999-12-31'

export function OnLoan({ loans, items, today }: OnLoanProps) {
  const byId = new Map(items.map((item) => [item.id, item]))
  const out = loans
    .flatMap((loan) => {
      const item = byId.get(loan.gearId)
      return loan.returnedOn === undefined && item?.status === 'lent-out' ? [{ loan, item }] : []
    })
    .sort((a, b) => (a.loan.dueDate ?? NO_DUE_DATE).localeCompare(b.loan.dueDate ?? NO_DUE_DATE))
  if (out.length === 0) return null

  return (
    <section aria-labelledby="on-loan-title" className="mb-8">
      <h2 id="on-loan-title" className="mb-3 text-base font-semibold">
        On loan
      </h2>
      <ul className="grid gap-2">
        {out.map(({ loan, item }) => {
          const late = daysOverdue(loan, today)
          return (
            <li
              key={loan.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-4 py-3"
            >
              <span>
                <Link
                  to="/gear/$gearId"
                  params={{ gearId: item.id }}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {gearName(item)}
                </Link>{' '}
                <span className="text-muted-foreground">with {loan.borrower}</span>
              </span>
              <span className="flex items-center gap-2 text-sm">
                {late > 0 ? (
                  <>
                    <span className="size-2 shrink-0 rounded-full bg-signal" />
                    {overdueText(late)}
                  </>
                ) : loan.dueDate === undefined ? (
                  <span className="text-muted-foreground">No set day</span>
                ) : (
                  <span>
                    Due <span className="font-mono">{formatDate(loan.dueDate)}</span>
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
