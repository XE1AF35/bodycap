// Everything recorded about an item, in the same groups as the form. Details never filled in are
// left out, and so is a group with nothing in it.
import { Fragment } from 'react'
import { formatDate, toIsoDate, type IsoDate } from '@/core/dates'
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  STATUS_LABELS,
  type Gear,
  type GearFields,
} from '@/core/gear'
import { formatMoney, type Money } from '@/core/money'
import { MOUNT_LABELS, SENSOR_FORMAT_LABELS } from '@/core/mounts'
import { FIELD_LABELS } from '@/ui/gear/labels'

type Row = readonly [label: string, value: string | undefined]

const date = (value?: IsoDate) => (value === undefined ? undefined : formatDate(value))
const money = (value?: Money) => (value === undefined ? undefined : formatMoney(value))
// Timestamps are UTC, but people think of when they added something in their own time zone
const day = (timestamp: string) => formatDate(toIsoDate(new Date(timestamp)))

function DetailSection({ title, rows }: { readonly title: string; readonly rows: readonly Row[] }) {
  const filled = rows.filter((row): row is readonly [string, string] => row[1] !== undefined)
  if (filled.length === 0) return null
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-2">
        {filled.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  )
}

const row = (field: keyof GearFields, value: string | undefined): Row => [
  FIELD_LABELS[field],
  value,
]

export function GearDetails({ item }: { readonly item: Gear }) {
  const mount = (value: Gear['mount']) => (value === undefined ? undefined : MOUNT_LABELS[value])
  const format = (value: Gear['sensorFormat']) =>
    value === undefined ? undefined : SENSOR_FORMAT_LABELS[value]
  const autofocus =
    item.adapterAutofocus === undefined ? undefined : item.adapterAutofocus ? 'Yes' : 'No'

  return (
    <>
      <DetailSection
        title="Basics"
        rows={[
          row('category', CATEGORY_LABELS[item.category]),
          row('brand', item.brand),
          row('model', item.model),
          row('nickname', item.nickname),
          row('serialNumber', item.serialNumber),
          row('mount', mount(item.mount)),
          row('sensorFormat', format(item.sensorFormat)),
          row('lensCoverage', format(item.lensCoverage)),
          row('adapterFrom', mount(item.adapterFrom)),
          row('adapterTo', mount(item.adapterTo)),
          row('adapterAutofocus', autofocus),
        ]}
      />
      <DetailSection
        title="Purchase"
        rows={[
          row('purchaseDate', date(item.purchaseDate)),
          row('purchasePrice', money(item.purchasePrice)),
          row('whereBought', item.whereBought),
          row(
            'condition',
            item.condition === undefined ? undefined : CONDITION_LABELS[item.condition],
          ),
        ]}
      />
      <DetailSection
        title="Status and location"
        rows={[
          row('status', STATUS_LABELS[item.status]),
          row('currentLocation', item.currentLocation),
          row('saleDate', date(item.saleDate)),
          row('salePrice', money(item.salePrice)),
          row('lostDate', date(item.lostDate)),
        ]}
      />
      <DetailSection
        title="Warranty and insurance"
        rows={[
          row('warrantyExpiry', date(item.warrantyExpiry)),
          row('insuredValue', money(item.insuredValue)),
        ]}
      />
      {item.notes !== undefined && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{FIELD_LABELS.notes}</h2>
          {/* pre-wrap keeps the line breaks people typed, while the text stays plain text */}
          <p className="whitespace-pre-wrap">{item.notes}</p>
        </section>
      )}
      <DetailSection
        title="Record"
        rows={[
          ['Added', day(item.createdAt)],
          ['Last changed', day(item.updatedAt)],
        ]}
      />
    </>
  )
}
