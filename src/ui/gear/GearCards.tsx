// The gear list as cards, for screens too narrow for the table. Both are in the page, and CSS
// shows one, so switching size never reloads anything.
import { Link } from '@tanstack/react-router'
import { formatDate } from '@/core/dates'
import { CATEGORY_LABELS, type Gear } from '@/core/gear'
import { formatMoney } from '@/core/money'
import { StatusBadge } from '@/ui/gear/StatusBadge'
import { gearName } from '@/ui/gear/labels'

export function GearCards({ items }: { readonly items: readonly Gear[] }) {
  return (
    <ul aria-label="Your gear" className="grid gap-3 md:hidden">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-border p-4">
          <Link
            to="/gear/$gearId"
            params={{ gearId: item.id }}
            className="font-medium underline-offset-4 hover:underline"
          >
            {gearName(item)}
          </Link>
          {item.nickname !== undefined && (
            <p className="text-sm text-muted-foreground">{item.nickname}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{CATEGORY_LABELS[item.category]}</span>
            <StatusBadge status={item.status} />
            {item.purchaseDate !== undefined && <span>{formatDate(item.purchaseDate)}</span>}
            {item.purchasePrice !== undefined && <span>{formatMoney(item.purchasePrice)}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}
