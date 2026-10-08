// A small bar after a number in a stats table, for the eye only: the number says the same, so
// screen readers skip it. Bars sit at the end of right-aligned cells, so they line up whatever the
// numbers' widths. Its width is an attribute, as the security policy allows no inline styles.
import { cn } from '@/ui/lib/utils'

/** `share` runs from 0 to 1 */
export function StatBar({
  share,
  className,
}: {
  readonly share: number
  readonly className?: string | undefined
}) {
  const width = `${(Math.min(Math.max(share, 0), 1) * 100).toFixed(1)}%`
  return (
    <svg aria-hidden="true" focusable="false" className={cn('h-2 w-24 shrink-0', className)}>
      <rect width="100%" height="100%" rx="4" className="fill-muted" />
      {share > 0 && <rect width={width} height="100%" rx="4" className="fill-foreground" />}
    </svg>
  )
}
