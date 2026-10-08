// What the gear you have adds up to, by what you paid or what it's insured for. Each currency is
// totalled on its own, since converting would need exchange rates, so the bars after each category
// compare amounts in the first currency only.
import { useState } from 'react'
import { CATEGORY_LABELS, type Gear } from '@/core/gear'
import { LOCALE } from '@/core/locale'
import { formatMoney, type CurrencyCode, type Money } from '@/core/money'
import { summariseValue, type ValueBasis } from '@/core/value'
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

const list = new Intl.ListFormat(LOCALE, { type: 'conjunction' })

const BASES: readonly (readonly [ValueBasis, string, string])[] = [
  ['purchase', 'What you paid', 'purchase price'],
  ['insured', 'Insured value', 'insured value'],
]

interface ValueSummaryProps {
  readonly items: readonly Gear[]
  /** The currency to list first, such as the last one used */
  readonly first?: CurrencyCode | undefined
}

export function ValueSummary({ items, first }: ValueSummaryProps) {
  const [basis, setBasis] = useState<ValueBasis>('purchase')
  const summary = summariseValue(items, basis, first)
  const missing = BASES.find(([choice]) => choice === basis)?.[2] ?? ''
  const { unpriced } = summary
  // The first currency listed, which the bars compare
  const [main] = summary.totals
  const shareOf = (totals: readonly Money[]) => {
    const amount = totals.find(({ currency }) => currency === main?.currency)
    return amount === undefined || main === undefined ? 0 : amount.amountMinor / main.amountMinor
  }

  return (
    <section aria-labelledby="value-title" className="mb-8">
      <h2 id="value-title" className="mb-3 text-base font-semibold">
        Value
      </h2>
      <fieldset className="mb-4 flex flex-wrap gap-4">
        <legend className="sr-only">Count gear by</legend>
        {BASES.map(([choice, label]) => (
          <div key={choice} className="flex items-center gap-2">
            <input
              id={`value-${choice}`}
              type="radio"
              name="value-basis"
              className="size-4 accent-primary"
              checked={basis === choice}
              onChange={() => {
                setBasis(choice)
              }}
            />
            <label htmlFor={`value-${choice}`}>{label}</label>
          </div>
        ))}
      </fieldset>

      {summary.totals.length === 0 ? (
        <p className="mb-4 text-muted-foreground">None of the gear you have has a {missing} yet.</p>
      ) : (
        <ul className="mb-2 grid gap-1 font-mono text-title font-medium tabular-nums">
          {summary.totals.map((total) => (
            <li key={total.currency}>{formatMoney(total)}</li>
          ))}
        </ul>
      )}
      {unpriced > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {unpriced === 1
            ? `1 item has no ${missing}, so it isn't counted.`
            : `${String(unpriced)} items have no ${missing}, so they aren't counted.`}
        </p>
      )}

      {summary.byCategory.length > 0 && (
        <div className="mb-4 max-w-md overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableCaption className="sr-only">Value by category</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">
                  <span className="label-engraved">Category</span>
                </TableHead>
                <TableHead scope="col" className="text-right">
                  <span className="label-engraved">Total</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byCategory.map(({ category, totals }) => (
                <TableRow key={category}>
                  <th scope="row" className="p-2 text-left font-normal">
                    {CATEGORY_LABELS[category]}
                  </th>
                  <TableCell className="text-right font-mono tabular-nums">
                    <span className="inline-flex items-center gap-3">
                      {totals.map(formatMoney).join(', ')}
                      <StatBar share={shareOf(totals)} className="w-16 sm:w-24" />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {main !== undefined && summary.totals.length > 1 && summary.byCategory.length > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          The bars compare amounts in {main.currency}.
        </p>
      )}

      {summary.wishlist.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Your wishlist adds up to {list.format(summary.wishlist.map(formatMoney))}.
        </p>
      )}
    </section>
  )
}
