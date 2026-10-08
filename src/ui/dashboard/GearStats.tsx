// Stats from the gear already kept: bodies and lenses by mount, how long ago gear was bought, the
// warranties still running, and how much gear is in kits. Each is a table, so the numbers are there
// for everyone, with bars beside them for the eye. A stat with nothing to show is left out.
import { Link } from '@tanstack/react-router'
import { useId, type ReactNode } from 'react'
import { formatDate, type IsoDate } from '@/core/dates'
import type { Gear } from '@/core/gear'
import type { Kit } from '@/core/kits'
import { LOCALE } from '@/core/locale'
import { MOUNT_LABELS } from '@/core/mounts'
import {
  gearAge,
  gearInKits,
  mountShare,
  warrantyTimeline,
  type AgeBand,
  type GearAge,
  type GearInKits,
  type MountShare,
  type WarrantyTimeline,
} from '@/core/stats'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table'
import { StatBar } from '@/ui/dashboard/StatBar'
import { gearName } from '@/ui/gear/labels'
import { itemCount } from '@/ui/settings/words'

const percent = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 })

const AGE_LABELS: Record<AgeBand, string> = {
  'under-1': 'Under a year',
  '1-2': '1 to 2 years',
  '3-5': '3 to 5 years',
  '6-10': '6 to 10 years',
  'over-10': 'Over 10 years',
}

/** Such as "24 days", "13 months", or "3 years", roughly, as a warranty's time left */
function timeLeft(days: number): string {
  if (days === 1) return '1 day'
  if (days < 60) return `${String(days)} days`
  if (days < 730) return `${String(Math.round(days / 30.44))} months`
  return `${String(Math.floor(days / 365.25))} years`
}

/** A card with a heading, a sentence or two, and the table */
function StatCard({
  title,
  summary,
  children,
}: {
  readonly title: string
  readonly summary: ReactNode
  readonly children?: ReactNode
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="grid content-start gap-3 rounded-lg border border-border bg-card p-4"
    >
      <h3 id={titleId} className="label-engraved">
        {title}
      </h3>
      <div className="grid gap-1 text-sm">{summary}</div>
      {children}
    </section>
  )
}

/** A stats table: a hidden caption names it, and the first column labels each row */
function StatTable({
  caption,
  headings,
  children,
}: {
  readonly caption: string
  readonly headings: readonly string[]
  readonly children: ReactNode
}) {
  return (
    <Table>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          {headings.map((heading, index) => (
            <TableHead key={heading} scope="col" className={index === 0 ? undefined : 'text-right'}>
              <span className="label-engraved">{heading}</span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  )
}

function RowLabel({ children }: { readonly children: ReactNode }) {
  return (
    <th scope="row" className="p-2 text-left font-normal">
      {children}
    </th>
  )
}

/** A number with its bar after it, right-aligned so the numbers and bars line up */
function BarCell({
  share,
  roomy = false,
  children,
}: {
  readonly share: number
  /** Only shows the bar from tablets up, for a table with too many columns for a phone */
  readonly roomy?: boolean
  readonly children: ReactNode
}) {
  return (
    <TableCell className="text-right font-mono tabular-nums">
      <span className="inline-flex items-center gap-3">
        {children}
        <StatBar share={share} className={roomy ? 'hidden sm:block' : undefined} />
      </span>
    </TableCell>
  )
}

function Mounts({ share: { mounts, unrecorded, total } }: { readonly share: MountShare }) {
  const [top, next] = mounts
  const rows = [
    ...mounts.map(({ mount, count }) => [MOUNT_LABELS[mount], count] as const),
    ...(unrecorded > 0 ? [['No mount recorded', unrecorded] as const] : []),
  ]
  return (
    <StatCard
      title="Mounts"
      summary={
        top !== undefined &&
        (next === undefined || top.count > next.count) && (
          <p>Your main mount is {MOUNT_LABELS[top.mount]}.</p>
        )
      }
    >
      <StatTable caption="Bodies and lenses by mount" headings={['Mount', 'Items', 'Share']}>
        {rows.map(([label, count]) => (
          <TableRow key={label}>
            <RowLabel>{label}</RowLabel>
            <TableCell className="text-right font-mono tabular-nums">{count}</TableCell>
            <BarCell share={count / total}>{percent.format(count / total)}</BarCell>
          </TableRow>
        ))}
      </StatTable>
    </StatCard>
  )
}

function Age({ age: { bands, unrecorded } }: { readonly age: GearAge }) {
  const most = Math.max(...bands.map(({ count }) => count))
  return (
    <StatCard
      title="Age"
      summary={
        unrecorded > 0 && (
          <p className="text-muted-foreground">
            {unrecorded === 1
              ? "1 item has no purchase date, so it isn't counted."
              : `${String(unrecorded)} items have no purchase date, so they aren't counted.`}
          </p>
        )
      }
    >
      <StatTable caption="Gear by when it was bought" headings={['Bought', 'Items']}>
        {bands.map(({ band, count }) => (
          <TableRow key={band}>
            <RowLabel>{AGE_LABELS[band]}</RowLabel>
            <BarCell share={count / most}>{count}</BarCell>
          </TableRow>
        ))}
      </StatTable>
    </StatCard>
  )
}

function Warranties({ timeline: { running, ended } }: { readonly timeline: WarrantyTimeline }) {
  const [first] = running
  const longest = Math.max(...running.map(({ daysLeft }) => daysLeft))
  const when = (days: number) => (days === 0 ? 'today' : `in ${timeLeft(days)}`)
  const sentences = [
    first === undefined
      ? 'None of your warranties are still running.'
      : running.length === 1
        ? `1 warranty is still running, ending ${when(first.daysLeft)}.`
        : `${String(running.length)} warranties are still running, the first ending ${when(first.daysLeft)}.`,
    ...(ended === 0 ? [] : [ended === 1 ? '1 has ended.' : `${String(ended)} have ended.`]),
  ]
  return (
    <StatCard title="Warranties" summary={<p>{sentences.join(' ')}</p>}>
      {running.length > 0 && (
        <StatTable caption="Warranties still running" headings={['Item', 'Ends', 'Time left']}>
          {running.map(({ item, warrantyExpiry, daysLeft }) => (
            <TableRow key={item.id}>
              <RowLabel>
                <Link
                  to="/gear/$gearId"
                  params={{ gearId: item.id }}
                  className="underline-offset-4 hover:underline"
                >
                  {gearName(item)}
                </Link>
              </RowLabel>
              <TableCell className="text-right font-mono tabular-nums">
                {formatDate(warrantyExpiry)}
              </TableCell>
              <BarCell share={longest === 0 ? 0 : daysLeft / longest} roomy>
                {daysLeft === 0 ? 'Ends today' : timeLeft(daysLeft)}
              </BarCell>
            </TableRow>
          ))}
        </StatTable>
      )}
    </StatCard>
  )
}

function Kits({ inKits: { kits, inKits, total } }: { readonly inKits: GearInKits }) {
  return (
    <StatCard
      title="Kits"
      summary={
        <p>
          {inKits} of the {itemCount(total)} you have {inKits === 1 ? 'is' : 'are'} in a kit.
        </p>
      }
    >
      <StatTable caption="Items in each kit" headings={['Kit', 'Items']}>
        {kits.map(({ kit, count }) => (
          <TableRow key={kit.id}>
            <RowLabel>
              <Link
                to="/kits/$kitId"
                params={{ kitId: kit.id }}
                className="underline-offset-4 hover:underline"
              >
                {kit.name}
              </Link>
            </RowLabel>
            <BarCell share={total === 0 ? 0 : count / total}>{count}</BarCell>
          </TableRow>
        ))}
      </StatTable>
    </StatCard>
  )
}

export function GearStats({
  items,
  kits,
  today,
}: {
  readonly items: readonly Gear[]
  readonly kits: readonly Kit[]
  readonly today: IsoDate
}) {
  const titleId = useId()
  const mounts = mountShare(items)
  const age = gearAge(items, today)
  const warranties = warrantyTimeline(items, today)
  const inKits = gearInKits(kits, items)
  const cards = [
    mounts.total > 0 && <Mounts key="mounts" share={mounts} />,
    age.bands.some(({ count }) => count > 0) && <Age key="age" age={age} />,
    (warranties.running.length > 0 || warranties.ended > 0) && (
      <Warranties key="warranties" timeline={warranties} />
    ),
    kits.length > 0 && <Kits key="kits" inKits={inKits} />,
  ].filter((card) => card !== false)
  if (cards.length === 0) return null

  return (
    <section aria-labelledby={titleId} className="mb-8">
      <h2 id={titleId} className="mb-3 text-base font-semibold">
        Your gear in numbers
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">{cards}</div>
    </section>
  )
}
