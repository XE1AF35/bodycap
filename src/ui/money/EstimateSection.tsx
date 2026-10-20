// Estimated value: what the gear you have is probably worth now, a table for each currency with your
// own estimates marked, and how the figures are worked out. Each currency is totalled on its own.
import { Link } from '@tanstack/react-router'
import { formatDate, type IsoDate } from '@/core/dates'
import {
  ESTIMATE_RATES,
  summariseEstimates,
  type EstimatedItem,
  type EstimateItem,
  type EstimateRate,
} from '@/core/estimate'
import { CATEGORIES, CATEGORY_LABELS, type Gear } from '@/core/gear'
import { LOCALE } from '@/core/locale'
import { formatMoney, type CurrencyCode, type Money } from '@/core/money'
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table'
import { gearName } from '@/ui/gear/labels'
import { itemCount } from '@/ui/settings/words'

type Item = EstimateItem & Pick<Gear, 'id' | 'brand' | 'model' | 'status'>

const percent = new Intl.NumberFormat(LOCALE, { style: 'percent' })

/** Categories that share a rate, in the usual category order, such as "Flash, drone" */
function rateGroups(): { readonly categories: string; readonly rate: EstimateRate }[] {
  const groups: { labels: string[]; rate: EstimateRate }[] = []
  for (const category of CATEGORIES) {
    const rate = ESTIMATE_RATES[category]
    const same = groups.find(
      (group) => group.rate.yearly === rate.yearly && group.rate.floor === rate.floor,
    )
    const label = CATEGORY_LABELS[category]
    if (same) same.labels.push(label.toLowerCase())
    else groups.push({ labels: [label], rate })
  }
  return groups.map(({ labels, rate }) => ({ categories: labels.join(', '), rate }))
}

const RATE_GROUPS = rateGroups()

function Head({
  children,
  right = false,
}: {
  readonly children: string
  readonly right?: boolean
}) {
  return (
    <TableHead scope="col" className={right ? 'text-right' : undefined}>
      <span className="label-engraved">{children}</span>
    </TableHead>
  )
}

interface CurrencyTableProps {
  readonly total: Money
  readonly rows: readonly EstimatedItem<Item>[]
}

function CurrencyTable({ total, rows }: CurrencyTableProps) {
  const { currency } = total
  const captionId = `estimate-caption-${currency}`
  return (
    <section aria-labelledby={`estimate-${currency}`} className="mb-6">
      <h3 id={`estimate-${currency}`} className="mb-2 font-mono text-sm font-medium">
        {currency}
      </h3>
      {/* Long names and big amounts can be wider than a phone, so the table can scroll */}
      <div
        role="region"
        aria-labelledby={captionId}
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-border bg-card"
      >
        <table className="w-full text-xs sm:text-sm">
          <TableCaption id={captionId} className="sr-only">
            Estimated value in {currency}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <Head>Item</Head>
              <Head right>Paid</Head>
              <Head right>Estimated value</Head>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ item, estimate }) => (
              <TableRow key={item.id}>
                <th scope="row" className="p-2 text-left font-normal">
                  <Link
                    to="/gear/$gearId"
                    params={{ gearId: item.id }}
                    className="underline underline-offset-4"
                  >
                    {gearName(item)}
                  </Link>
                </th>
                <TableCell className="text-right font-mono tabular-nums">
                  {item.purchasePrice === undefined ? '' : formatMoney(item.purchasePrice)}
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono tabular-nums">{formatMoney(estimate.value)}</span>
                  {estimate.source === 'own' && (
                    <span className="block text-xs text-muted-foreground">
                      Your own, set {formatDate(estimate.setOn)}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <th scope="row" className="p-2 text-left font-medium">
                Total
              </th>
              <TableCell />
              <TableCell className="text-right font-mono font-medium tabular-nums">
                {formatMoney(total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </table>
      </div>
    </section>
  )
}

function Method() {
  return (
    <section aria-labelledby="estimate-method" className="max-w-2xl">
      <h3 id="estimate-method" className="mb-2 text-sm font-semibold">
        How it's worked out
      </h3>
      <p className="mb-2 text-sm text-muted-foreground">
        Each item loses the same share of its value every year since its purchase date, counting
        part years too, but never drops below the share of its price in the table, if it has one.
        Bodycap doesn't know whether you bought an item new or used, so there's no extra drop in the
        first year.
      </p>
      <p className="mb-4 text-sm text-muted-foreground">
        The rates are rough guides from typical resale prices, closest for camera bodies and lenses.
        Where you've given your own estimate, that's used instead, and it doesn't go down. It's an
        estimate for selling or insuring, not a valuation, and not tax advice.
      </p>
      <div
        role="region"
        aria-labelledby="estimate-rates"
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-border bg-card"
      >
        <table className="w-full text-xs sm:text-sm">
          <TableCaption id="estimate-rates" className="sr-only">
            Yearly rates
          </TableCaption>
          <TableHeader>
            <TableRow>
              <Head>Category</Head>
              <Head right>Lost each year</Head>
              <Head right>Never below</Head>
            </TableRow>
          </TableHeader>
          <TableBody>
            {RATE_GROUPS.map(({ categories, rate }) => (
              <TableRow key={categories}>
                <th scope="row" className="p-2 text-left font-normal">
                  {categories}
                </th>
                <TableCell className="text-right font-mono tabular-nums">
                  {percent.format(rate.yearly)}
                </TableCell>
                <TableCell className="text-right">
                  {rate.floor === 0 ? 'No floor' : `${percent.format(rate.floor)} of the price`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    </section>
  )
}

/** Such as "1 item has no purchase date, so the estimate doesn't include it." */
function leftOut(count: number, missing: string) {
  const one = count === 1
  return `${itemCount(count)} ${one ? 'has' : 'have'} no ${missing}, so the estimate doesn't include ${one ? 'it' : 'them'}.`
}

interface EstimateSectionProps {
  readonly items: readonly Item[]
  readonly today: IsoDate
  /** The currency to list first, such as the last one used */
  readonly first?: CurrencyCode | undefined
}

export function EstimateSection({ items, today, first }: EstimateSectionProps) {
  const { items: estimated, totals, noPrice, noDate } = summariseEstimates(items, today, first)
  return (
    <section aria-labelledby="estimate-title" className="mb-8">
      <h2 id="estimate-title" className="mb-1 text-base font-semibold">
        Estimated value
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        What the gear you have is probably worth now, if you sold it.
      </p>
      {totals.length === 0 ? (
        <p className="mb-4 text-muted-foreground">Nothing to estimate yet.</p>
      ) : (
        totals.map((total) => (
          <CurrencyTable
            key={total.currency}
            total={total}
            rows={estimated
              .filter(({ estimate }) => estimate.value.currency === total.currency)
              .sort((a, b) => b.estimate.value.amountMinor - a.estimate.value.amountMinor)}
          />
        ))
      )}
      {noPrice > 0 && (
        <p className="mb-2 text-sm text-muted-foreground">{leftOut(noPrice, 'purchase price')}</p>
      )}
      {noDate > 0 && (
        <p className="mb-2 text-sm text-muted-foreground">{leftOut(noDate, 'purchase date')}</p>
      )}
      <Method />
    </section>
  )
}
