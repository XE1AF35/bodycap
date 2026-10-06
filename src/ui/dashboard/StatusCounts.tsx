// How many items are in each status, each linking to the gear list filtered by it. Statuses with
// nothing in them are left out.
import { Link } from '@tanstack/react-router'
import { STATUSES, type Gear } from '@/core/gear'
import { countByStatus } from '@/core/value'
import { StatusDot } from '@/ui/gear/StatusDot'

export function StatusCounts({ items }: { readonly items: readonly Gear[] }) {
  const counts = countByStatus(items)
  return (
    <section aria-labelledby="counts-title" className="mb-8">
      <h2 id="counts-title" className="mb-3 text-base font-semibold">
        Your gear
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STATUSES.filter((status) => counts[status] > 0).map((status) => (
          <li key={status}>
            <Link
              to="/gear"
              search={{ status }}
              className="grid gap-1 rounded-lg border border-border bg-card p-4 hover:bg-muted"
            >
              <span className="font-mono text-title font-medium tabular-nums">
                {counts[status]}
              </span>{' '}
              <span className="text-sm text-muted-foreground">
                <StatusDot status={status} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
