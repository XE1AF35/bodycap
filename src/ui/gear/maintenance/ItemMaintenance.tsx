// An item's maintenance log on its page: sensor cleans, firmware updates, repairs, and anything
// else, the most recent first, with what it all cost in each currency.
import { useId, useMemo, useRef, useState } from 'react'
import { formatDate, toIsoDate } from '@/core/dates'
import type { Gear } from '@/core/gear'
import { LOCALE } from '@/core/locale'
import { MAINTENANCE_TYPE_LABELS, maintenanceHistory } from '@/core/maintenance'
import { formatMoney, sumByCurrency } from '@/core/money'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { DeleteMaintenanceButton } from './DeleteMaintenanceButton'
import { MaintenanceDialog } from './MaintenanceDialog'

const list = new Intl.ListFormat(LOCALE, { type: 'conjunction' })

export function ItemMaintenance({ item }: { readonly item: Gear }) {
  const { repositories } = useServices()
  const records = useLive(
    useMemo(() => repositories.maintenance.forGear(item.id), [repositories, item.id]),
  )
  // Read once, which is close enough for dates typed while the page is open
  const [today] = useState(() => toIsoDate(new Date()))
  const titleId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Newest logged first, so work done on the same day shows the latest entry on top
  const history =
    records.status === 'ready'
      ? maintenanceHistory(
          [...records.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          item.id,
        )
      : []
  const spent = sumByCurrency(
    history.flatMap(({ cost }) => (cost === undefined ? [] : [cost])),
    item.purchasePrice?.currency,
  )

  return (
    <section aria-labelledby={titleId} className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {/* Focusable from script, for after a record is deleted */}
        <h2
          id={titleId}
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold outline-none"
        >
          Maintenance
        </h2>
        <MaintenanceDialog item={item} today={today} />
      </div>
      {records.status === 'ready' && history.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
      )}
      {spent.length > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          {`Spent so far: ${list.format(spent.map(formatMoney))}`}
        </p>
      )}
      <ul className="grid gap-2">
        {history.map((record) => (
          <li key={record.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-medium">{MAINTENANCE_TYPE_LABELS[record.type]}</h3>
              <span className="font-mono text-sm text-muted-foreground">
                {formatDate(record.date)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {record.cost !== undefined && (
                <span className="font-mono">{formatMoney(record.cost)}</span>
              )}
              {record.provider !== undefined && <span>{record.provider}</span>}
              {record.firmwareVersion !== undefined && (
                <span>Version {record.firmwareVersion}</span>
              )}
            </div>
            {record.notes !== undefined && (
              <p className="mt-2 text-sm whitespace-pre-wrap">{record.notes}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <MaintenanceDialog item={item} record={record} today={today} />
              <DeleteMaintenanceButton record={record} afterDelete={headingRef} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
