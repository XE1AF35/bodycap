// The gear list as a table, for wider screens. Sortable column headers are buttons, and the sorted
// column says so with aria-sort.
import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { formatDate } from '@/core/dates'
import { CATEGORY_LABELS, type Gear } from '@/core/gear'
import { formatMoney } from '@/core/money'
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
import { StatusBadge } from '@/ui/gear/StatusBadge'
import { gearName, mountText } from '@/ui/gear/labels'

interface GearTableProps {
  readonly items: readonly Gear[]
  readonly sort: SortKey
  readonly descending: boolean
  readonly onSort: (key: SortKey) => void
}

interface SortableHeadProps extends Omit<GearTableProps, 'items'> {
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
        {label}
        <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </button>
    </TableHead>
  )
}

export function GearTable({ items, ...sorting }: GearTableProps) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableCaption className="sr-only">Your gear</TableCaption>
        <TableHeader>
          <TableRow>
            <SortableHead sortKey="name" label="Name" {...sorting} />
            <SortableHead sortKey="category" label="Category" {...sorting} />
            <SortableHead sortKey="status" label="Status" {...sorting} />
            <TableHead scope="col">Mount</TableHead>
            <SortableHead sortKey="purchaseDate" label="Purchase date" {...sorting} />
            <TableHead scope="col" className="text-right">
              Price
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <th scope="row" className="p-2 text-left font-normal">
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
              </th>
              <TableCell>{CATEGORY_LABELS[item.category]}</TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell>{mountText(item)}</TableCell>
              <TableCell>
                {item.purchaseDate === undefined ? '' : formatDate(item.purchaseDate)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {item.purchasePrice === undefined ? '' : formatMoney(item.purchasePrice)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
