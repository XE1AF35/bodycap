// Spend by calendar year: a table for each currency, with the items that have no purchase date in a
// row of their own, and a chart of net spend under it. Each currency is totalled on its own, since
// converting would need exchange rates.
import { formatMoney, type CurrencyCode } from '@/core/money'
import { spendByYear, type CurrencySpend, type SpendItem, type SpendRecord } from '@/core/spend'
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table'
import { SpendChart } from '@/ui/money/SpendChart'
import { itemCount } from '@/ui/settings/words'

const COLUMNS = [
  ['bought', 'Bought'],
  ['maintenance', 'Maintenance'],
  ['sold', 'Sold'],
  ['net', 'Net spend'],
] as const

function CurrencyTable({ spend }: { readonly spend: CurrencySpend }) {
  const { currency, years, undatedBought } = spend
  const money = (amountMinor: number) => formatMoney({ amountMinor, currency })
  const chartId = `spend-chart-${currency}`
  const captionId = `spend-caption-${currency}`
  return (
    <section aria-labelledby={`spend-${currency}`} className="mb-8">
      <h3 id={`spend-${currency}`} className="mb-2 font-mono text-sm font-medium">
        {currency}
      </h3>
      {/* Big amounts can be wider than a phone, so the table can scroll, by keyboard too */}
      <div
        role="region"
        aria-labelledby={captionId}
        tabIndex={0}
        className="mb-4 overflow-x-auto rounded-lg border border-border bg-card"
      >
        <table className="w-full text-xs sm:text-sm">
          <TableCaption id={captionId} className="sr-only">
            Spend by year in {currency}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">
                <span className="label-engraved">Year</span>
              </TableHead>
              {COLUMNS.map(([key, label]) => (
                <TableHead key={key} scope="col" className="text-right">
                  <span className="label-engraved">{label}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {years.map((row) => (
              <TableRow key={row.year}>
                <th scope="row" className="p-2 text-left font-mono font-normal tabular-nums">
                  {row.year}
                </th>
                {COLUMNS.map(([key]) => (
                  <TableCell key={key} className="text-right font-mono tabular-nums">
                    {money(row[key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {undatedBought > 0 && (
              <TableRow>
                <th scope="row" className="p-2 text-left font-normal">
                  No purchase date
                </th>
                <TableCell className="text-right font-mono tabular-nums">
                  {money(undatedBought)}
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-mono tabular-nums">
                  {money(undatedBought)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
      {years.length > 0 && (
        <figure aria-labelledby={chartId} className="max-w-xl">
          <SpendChart years={years} />
          <figcaption id={chartId} className="mt-2 text-sm text-muted-foreground">
            Net spend by year in {currency}
          </figcaption>
        </figure>
      )}
    </section>
  )
}

interface SpendSectionProps {
  readonly items: readonly SpendItem[]
  readonly records: readonly SpendRecord[]
  /** The currency to list first, such as the last one used */
  readonly first?: CurrencyCode | undefined
}

export function SpendSection({ items, records, first }: SpendSectionProps) {
  const { currencies, undated, unpriced } = spendByYear(items, records, first)
  return (
    <section aria-labelledby="spend-title" className="mb-8">
      <h2 id="spend-title" className="mb-1 text-base font-semibold">
        Spend
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        What your gear cost each calendar year. Net spend is what you bought plus maintenance, less
        what you sold.
      </p>
      {currencies.length === 0 ? (
        <p className="mb-4 text-muted-foreground">Nothing bought yet.</p>
      ) : (
        currencies.map((spend) => <CurrencyTable key={spend.currency} spend={spend} />)
      )}
      {undated > 0 && (
        <p className="mb-2 text-sm text-muted-foreground">
          {itemCount(undated)} {undated === 1 ? 'has' : 'have'} no purchase date, so{' '}
          {undated === 1 ? "it's" : "they're"} counted apart from the years.
        </p>
      )}
      {unpriced > 0 && (
        <p className="mb-2 text-sm text-muted-foreground">
          {itemCount(unpriced)} {unpriced === 1 ? 'has' : 'have'} no purchase price, so the totals
          don't include {unpriced === 1 ? 'it' : 'them'}.
        </p>
      )}
    </section>
  )
}
