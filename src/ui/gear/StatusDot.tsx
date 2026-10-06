// An item's status as a word with a dot beside it. The word carries the meaning; the dot only helps
// the eye group a list. Red is kept for lost gear, the one status that needs attention.
import { STATUS_LABELS, type Status } from '@/core/gear'
import { cn } from '@/ui/lib/utils'

// Filled while it's yours, faded while it's away, and hollow when you don't have it
const DOT: Record<Status, string> = {
  owned: 'bg-foreground',
  'lent-out': 'bg-muted-foreground',
  'in-repair': 'bg-muted-foreground',
  wishlist: 'border border-muted-foreground',
  sold: 'border border-muted-foreground',
  lost: 'bg-signal',
}

export function StatusDot({ status }: { readonly status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn('size-2 shrink-0 rounded-full', DOT[status])} />
      {STATUS_LABELS[status]}
    </span>
  )
}
