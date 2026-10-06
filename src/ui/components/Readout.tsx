// A spec readout, like the specs printed on a box: engraved labels and their values, divided by
// hairlines. Rows with nothing in them are left out, and so is a readout with no rows.
import type { ReactNode } from 'react'
import { cn } from '@/ui/lib/utils'

export interface ReadoutRow {
  /** Keep to three words or fewer, as the label is set in spaced capitals */
  readonly label: string
  readonly value: ReactNode
  /** Numbers, dates, serials, and codes, set in the data font so their digits line up */
  readonly data?: boolean
}

const isBlank = (value: ReactNode) =>
  value === undefined || value === null || value === false || value === ''

export function Readout({ rows }: { readonly rows: readonly ReadoutRow[] }) {
  const filled = rows.filter((row) => !isBlank(row.value))
  if (filled.length === 0) return null
  return (
    // Sized by its own width rather than the window's, so it fits a half-width column too
    <dl className="@container divide-y divide-border border-y border-border">
      {filled.map(({ label, value, data = false }) => (
        <div
          key={label}
          className="grid grid-cols-[minmax(7rem,2fr)_3fr] items-baseline gap-x-4 py-2 @md:grid-cols-[10rem_1fr]"
        >
          <dt className="label-engraved">{label}</dt>
          <dd className={cn('min-w-0 break-words', data && 'font-mono tabular-nums')}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
