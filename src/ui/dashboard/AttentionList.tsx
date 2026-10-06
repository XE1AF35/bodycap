// The dashboard's alerts in plain words: backups falling behind, storage, warranties, and serials
// entered twice. Each item it mentions links to that item.
import { Link } from '@tanstack/react-router'
import { Fragment, type ReactNode } from 'react'
import type { Alert } from '@/core/alerts'
import type { Gear } from '@/core/gear'
import { LOCALE } from '@/core/locale'
import { gearName } from '@/ui/gear/labels'

const days = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
const percent = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 })
const count = new Intl.NumberFormat(LOCALE)

function ItemLink({ item }: { readonly item: Gear }) {
  return (
    <Link to="/gear/$gearId" params={{ gearId: item.id }} className="underline underline-offset-4">
      {gearName(item)}
    </Link>
  )
}

/** Links to items, joined as words are, such as "A, B and C" */
function joined(items: readonly Gear[]): ReactNode {
  return items.map((item, index) => (
    <Fragment key={item.id}>
      {index > 0 && (index === items.length - 1 ? ' and ' : ', ')}
      <ItemLink item={item} />
    </Fragment>
  ))
}

function describe(alert: Alert, byId: ReadonlyMap<string, Gear>): ReactNode {
  switch (alert.kind) {
    case 'backup': {
      if (alert.reason === 'never') {
        return "You haven't made a backup yet. Your gear lives only in this browser, so a backup is what keeps it safe."
      }
      const changes = `${count.format(alert.changes)} ${alert.changes === 1 ? 'change' : 'changes'}`
      return `Your last backup was ${days.format(-alert.daysSince, 'day')}, and you've made ${changes} since. Back up to keep them safe.`
    }
    case 'storage-nearly-full':
      return `Storage for Bodycap is ${percent.format(alert.usedFraction)} full. Make a backup, then free up some space on this device.`
    case 'storage-not-persisted':
      return "This browser hasn't promised to keep Bodycap's data yet. That's normal at first, as browsers decide based on how a site is used. Backups keep your gear safe either way."
    case 'warranty': {
      const item = byId.get(alert.id)
      if (item === undefined) return null
      const when = days.format(alert.daysLeft, 'day')
      return (
        <>
          The warranty on <ItemLink item={item} /> {alert.daysLeft >= 0 ? 'ends' : 'ended'} {when}.
        </>
      )
    }
    case 'duplicate-serial': {
      const items = alert.ids.flatMap((id) => byId.get(id) ?? [])
      return (
        <>
          {joined(items)} share the serial number {alert.serialKey}. Check they aren't the same item
          entered twice.
        </>
      )
    }
  }
}

function alertKey(alert: Alert): string {
  switch (alert.kind) {
    case 'warranty':
      return `warranty-${alert.id}`
    case 'duplicate-serial':
      return `serial-${alert.serialKey}`
    default:
      return alert.kind
  }
}

export function AttentionList({
  alerts,
  items,
}: {
  readonly alerts: readonly Alert[]
  readonly items: readonly Gear[]
}) {
  const byId = new Map(items.map((item) => [item.id, item]))
  return (
    <section aria-labelledby="attention-title" className="mb-8">
      <h2 id="attention-title" className="mb-3 text-lg font-semibold">
        Needs attention
      </h2>
      <ul className="grid gap-2">
        {alerts.map((alert) => (
          <li key={alertKey(alert)} className="rounded-lg border border-border px-4 py-3">
            {describe(alert, byId)}
          </li>
        ))}
      </ul>
    </section>
  )
}
