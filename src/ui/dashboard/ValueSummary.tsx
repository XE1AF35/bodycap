// What the gear you have adds up to, by what you paid or what it's insured for. Each currency is
// totalled on its own, since converting would need exchange rates.
import { useState } from 'react'
import { CATEGORY_LABELS, type Gear } from '@/core/gear'
import { LOCALE } from '@/core/locale'
import { formatMoney, type CurrencyCode } from '@/core/money'
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

  return (
    <section aria-labelledby="value-title" className="mb-8">
      <h2 id="value-title" className="mb-3 text-lg font-semibold">
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
        <ul className="mb-2 grid gap-1 text-2xl font-semibold tabular-nums">
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
        <Table className="mb-4 max-w-md">
          <TableCaption className="sr-only">Value by category</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Category</TableHead>
              <TableHead scope="col" className="text-right">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.byCategory.map(({ category, totals }) => (
              <TableRow key={category}>
                <th scope="row" className="p-2 text-left font-normal">
                  {CATEGORY_LABELS[category]}
                </th>
                <TableCell className="text-right tabular-nums">
                  {totals.map(formatMoney).join(', ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {summary.wishlist.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Your wishlist adds up to {list.format(summary.wishlist.map(formatMoney))}.
        </p>
      )}
    </section>
  )
}
