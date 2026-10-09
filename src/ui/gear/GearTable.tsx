// The gear list as a table, for wider screens. Sortable column headers are buttons, and the sorted
// column says so with aria-sort. Mounts show as badges, and dates and prices in the data font.
import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { formatDate } from '@/core/dates'
import { CATEGORY_LABELS, type Gear } from '@/core/gear'
import { formatMoney } from '@/core/money'
import type { Photo } from '@/core/photos'
import type { SortKey } from '@/core/search'
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
import { MountBadge } from '@/ui/gear/MountBadge'
import { StatusDot } from '@/ui/gear/StatusDot'
import { gearName } from '@/ui/gear/labels'

interface GearTableProps {
  readonly items: readonly Gear[]
  /** Each item's cover photo, by the item's ID */
  readonly covers: ReadonlyMap<string, Photo>
  readonly sort: SortKey
  readonly descending: boolean
  readonly onSort: (key: SortKey) => void
}

interface SortableHeadProps extends Omit<GearTableProps, 'items' | 'covers'> {
  readonly sortKey: SortKey
  readonly label: string
}

function SortableHead({ sortKey, label, sort, descending, onSort }: SortableHeadProps) {
  const sorted = sortKey === sort
  const Icon = !sorted ? ArrowUpDown : descending ? ArrowDown : ArrowUp
  return (
    <TableHead
      scope="col"
      aria-sort={sorted ? (descending ? 'descending' : 'ascending') : undefined}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-sm hover:underline"
        onClick={() => {
          onSort(sortKey)
        }}
      >
        <span className="label-engraved">{label}</span>
        <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </button>
    </TableHead>
  )
}

export function GearTable({ items, covers, ...sorting }: GearTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
      <Table>
        <TableCaption className="sr-only">Your gear</TableCaption>
        <TableHeader>
          <TableRow>
            <SortableHead sortKey="name" label="Name" {...sorting} />
            <SortableHead sortKey="category" label="Category" {...sorting} />
            <SortableHead sortKey="status" label="Status" {...sorting} />
            <TableHead scope="col">
              <span className="label-engraved">Mount</span>
            </TableHead>
            <SortableHead sortKey="purchaseDate" label="Purchase date" {...sorting} />
            <TableHead scope="col" className="text-right">
              <span className="label-engraved">Price</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <th scope="row" className="px-2 py-2.5 text-left font-normal">
                <div className="flex items-center gap-3">
                  <CoverThumbnail photo={covers.get(item.id)} />
                  <div>
                    <Link
                      to="/gear/$gearId"
                      params={{ gearId: item.id }}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {gearName(item)}
                    </Link>
                    {item.nickname !== undefined && (
                      <div className="text-xs text-muted-foreground">{item.nickname}</div>
                    )}
                  </div>
                </div>
              </th>
              <TableCell>{CATEGORY_LABELS[item.category]}</TableCell>
              <TableCell>
                <StatusDot status={item.status} />
              </TableCell>
              <TableCell>
                <MountBadge gear={item} />
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {item.purchaseDate === undefined ? '' : formatDate(item.purchaseDate)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {item.purchasePrice === undefined ? '' : formatMoney(item.purchasePrice)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
