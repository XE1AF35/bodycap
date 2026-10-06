// How many items are in each status, each linking to the gear list filtered by it. Statuses with
// nothing in them are left out.
import { Link } from '@tanstack/react-router'
import { STATUSES, STATUS_LABELS, type Gear } from '@/core/gear'
import { countByStatus } from '@/core/value'

export function StatusCounts({ items }: { readonly items: readonly Gear[] }) {
  const counts = countByStatus(items)
  return (
    <section aria-labelledby="counts-title" className="mb-8">
      <h2 id="counts-title" className="mb-3 text-lg font-semibold">
        Your gear
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STATUSES.filter((status) => counts[status] > 0).map((status) => (
          <li key={status}>
            <Link
              to="/gear"
              search={{ status }}
              className="block rounded-lg border border-border p-4 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="block text-2xl font-semibold tabular-nums">{counts[status]}</span>{' '}
              <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
