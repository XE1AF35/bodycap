// An item's status as a small label. The word carries the meaning, never the colour alone.
import { STATUS_LABELS, type Status } from '@/core/gear'
import { Badge } from '@/ui/components/ui/badge'

export function StatusBadge({ status }: { readonly status: Status }) {
  return <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
}
