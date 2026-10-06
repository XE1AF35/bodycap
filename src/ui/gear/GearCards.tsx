// The gear list as cards, for screens too narrow for the table. Both are in the page, and CSS
// shows one, so switching size never reloads anything.
import { Link } from '@tanstack/react-router'
import { formatDate } from '@/core/dates'
import { CATEGORY_LABELS, type Gear } from '@/core/gear'
import { formatMoney } from '@/core/money'
import { MountBadge } from '@/ui/gear/MountBadge'
import { StatusDot } from '@/ui/gear/StatusDot'
import { gearName } from '@/ui/gear/labels'

/** Such as "Bought 1 Mar 2026 for $3,899.00", with the data in the data font */
function Bought({ item }: { readonly item: Gear }) {
  const { purchaseDate, purchasePrice } = item
  if (purchaseDate === undefined && purchasePrice === undefined) return null
  return (
    <span className="text-muted-foreground">
      Bought
      {purchaseDate !== undefined && (
        <>
          {' '}
          <span className="font-mono tabular-nums">{formatDate(purchaseDate)}</span>
        </>
      )}
      {purchasePrice !== undefined && (
        <>
          {' for '}
          <span className="font-mono tabular-nums">{formatMoney(purchasePrice)}</span>
        </>
      )}
    </span>
  )
}

export function GearCards({ items }: { readonly items: readonly Gear[] }) {
  return (
    <ul aria-label="Your gear" className="grid gap-3 md:hidden">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                to="/gear/$gearId"
                params={{ gearId: item.id }}
                className="font-medium break-words underline-offset-4 hover:underline"
              >
                {gearName(item)}
              </Link>
              {item.nickname !== undefined && (
                <p className="text-sm text-muted-foreground">{item.nickname}</p>
              )}
            </div>
            <MountBadge gear={item} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <StatusDot status={item.status} />
            <span className="text-muted-foreground">{CATEGORY_LABELS[item.category]}</span>
            <Bought item={item} />
          </div>
        </li>
      ))}
    </ul>
  )
}
