// The insurance list: the gear you have, with what an insurer usually asks for, and totals per
// currency. It's laid out for paper, so printing it, or saving it as a PDF from the print dialog,
// leaves out the header and the controls.
import { Printer } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { formatDate, toIsoDate } from '@/core/dates'
import { CATEGORY_LABELS, type Gear } from '@/core/gear'
import { insuranceList, type InsuranceList } from '@/core/insurance'
import { LOCALE } from '@/core/locale'
import { formatMoney, type Money } from '@/core/money'
import type { Photo } from '@/core/photos'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { Button } from '@/ui/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table'
import { CoverThumbnail } from '@/ui/gear/CoverThumbnail'
import { startingCurrency } from '@/ui/gear/form/currencies'
import { gearName } from '@/ui/gear/labels'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

const list = new Intl.ListFormat(LOCALE, { type: 'conjunction' })
const NO_COVERS: ReadonlyMap<string, Photo> = new Map()

const money = (amount: Money | undefined) => (amount === undefined ? '' : formatMoney(amount))
const totalText = (totals: readonly Money[]) =>
  totals.length === 0 ? 'None recorded' : list.format(totals.map(formatMoney))

/** Such as "1 item has no insured value." */
function missingText(count: number, what: string): string {
  return count === 1 ? `1 item has no ${what}.` : `${String(count)} items have no ${what}.`
}

function Totals({ list: listed }: { readonly list: InsuranceList<Gear> }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="mt-6 grid gap-2 break-inside-avoid">
      <h2 id={titleId} className="text-base font-semibold">
        Totals
      </h2>
      <dl className="grid w-fit grid-cols-[auto_auto] gap-x-6 gap-y-1">
        <dt className="text-muted-foreground">Insured for</dt>
        <dd className="font-mono tabular-nums">{totalText(listed.insured)}</dd>
        <dt className="text-muted-foreground">Paid</dt>
        <dd className="font-mono tabular-nums">{totalText(listed.paid)}</dd>
      </dl>
      {listed.uninsured > 0 && (
        <p className="text-sm text-muted-foreground">
          {missingText(listed.uninsured, 'insured value')}
        </p>
      )}
      {listed.unpriced > 0 && (
        <p className="text-sm text-muted-foreground">
          {missingText(listed.unpriced, 'purchase price')}
        </p>
      )}
    </section>
  )
}

export function InsurancePage() {
  const { repositories } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))
  const covers = useLive(useMemo(() => repositories.photos.covers(), [repositories]))
  const settings = useLive(useMemo(() => repositories.settings.get(), [repositories]))
  const [withPhotos, setWithPhotos] = useState(true)
  const [today] = useState(() => toIsoDate(new Date()))

  if (gear.status === 'loading') {
    return (
      <Page title="Insurance list">
        <p className="text-muted-foreground">Loading your gear.</p>
      </Page>
    )
  }
  if (gear.status === 'error') {
    return (
      <Page title="Insurance list">
        <p role="alert">Your gear couldn't be loaded. Reload the page to try again.</p>
      </Page>
    )
  }

  const listed = insuranceList(
    gear.value,
    startingCurrency(settings.status === 'ready' ? settings.value : undefined),
  )
  const coverPhotos = covers.status === 'ready' ? covers.value : NO_COVERS
  const anyCovers = listed.items.some(({ id }) => coverPhotos.has(id))
  const showPhotos = withPhotos && anyCovers

  if (listed.items.length === 0) {
    return (
      <Page title="Insurance list">
        <EmptyState drawing="body-cap" title="Nothing to insure yet.">
          Gear you own, have lent out, or have in for repair shows here.
        </EmptyState>
      </Page>
    )
  }

  return (
    <Page
      title="Insurance list"
      description={
        <p className="max-w-prose text-muted-foreground">
          The gear you have, with what an insurer usually asks for. Print it, or save it as a PDF
          from the print dialog.
        </p>
      }
      actions={
        <Button
          className="print:hidden"
          onClick={() => {
            window.print()
          }}
        >
          <Printer aria-hidden="true" />
          Print
        </Button>
      }
    >
      {anyCovers && (
        <div className="mb-4 flex items-center gap-2 print:hidden">
          <input
            id="insurance-photos"
            type="checkbox"
            className="size-4 accent-primary"
            checked={withPhotos}
            onChange={(event) => {
              setWithPhotos(event.target.checked)
            }}
          />
          <label htmlFor="insurance-photos">Show cover photos</label>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-card print:overflow-visible print:border-0">
        <Table>
          <TableCaption className="sr-only">Insurance list</TableCaption>
          <TableHeader>
            <TableRow>
              {showPhotos && (
                <TableHead scope="col">
                  <span className="sr-only">Photo</span>
                </TableHead>
              )}
              <TableHead scope="col">
                <span className="label-engraved">Item</span>
              </TableHead>
              <TableHead scope="col">
                <span className="label-engraved">Category</span>
              </TableHead>
              <TableHead scope="col">
                <span className="label-engraved">Serial number</span>
              </TableHead>
              <TableHead scope="col">
                <span className="label-engraved">Purchased</span>
              </TableHead>
              <TableHead scope="col" className="text-right">
                <span className="label-engraved">Paid</span>
              </TableHead>
              <TableHead scope="col" className="text-right">
                <span className="label-engraved">Insured for</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listed.items.map((item) => (
              <TableRow key={item.id} className="break-inside-avoid">
                {showPhotos && (
                  <TableCell>
                    <CoverThumbnail photo={coverPhotos.get(item.id)} />
                  </TableCell>
                )}
                <th scope="row" className="px-2 py-2.5 text-left font-medium">
                  {gearName(item)}
                </th>
                <TableCell>{CATEGORY_LABELS[item.category]}</TableCell>
                <TableCell className="font-mono">{item.serialNumber ?? ''}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {item.purchaseDate === undefined ? '' : formatDate(item.purchaseDate)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {money(item.purchasePrice)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {money(item.insuredValue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Totals list={listed} />
      <p className="mt-6 text-sm text-muted-foreground">
        Made with Bodycap on {formatDate(today)}.
      </p>
    </Page>
  )
}
