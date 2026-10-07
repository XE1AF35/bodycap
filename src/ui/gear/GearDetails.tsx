// Everything recorded about an item, in the same groups as the form, each as a spec readout. Details
// never filled in are left out, and so is a group with nothing in it. On wide screens the groups
// flow down two columns, so the reading order stays the same as the page's.
import { formatDate, toIsoDate, type IsoDate } from '@/core/dates'
import { CATEGORY_LABELS, CONDITION_LABELS, type Gear, type GearFields } from '@/core/gear'
import { formatMoney, type Money } from '@/core/money'
import { MOUNT_LABELS, SENSOR_FORMAT_LABELS } from '@/core/mounts'
import { formatAperture, formatFocalLength } from '@/core/optics'
import { Readout, type ReadoutRow } from '@/ui/components/Readout'
import { StatusDot } from '@/ui/gear/StatusDot'
import { FIELD_LABELS } from '@/ui/gear/labels'

const date = (value?: IsoDate) => (value === undefined ? undefined : formatDate(value))
const money = (value?: Money) => (value === undefined ? undefined : formatMoney(value))
// Timestamps are UTC, but people think of when they added something in their own time zone
const day = (timestamp: string) => formatDate(toIsoDate(new Date(timestamp)))

function DetailSection({ title, rows }: { readonly title: string; readonly rows: ReadoutRow[] }) {
  if (rows.every((row) => row.value === undefined)) return null
  return (
    <section className="mb-8 break-inside-avoid">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      <Readout rows={rows} />
    </section>
  )
}

const row = (field: keyof GearFields, value: ReadoutRow['value']): ReadoutRow => ({
  label: FIELD_LABELS[field],
  value,
})

/** A row of numbers, dates, or codes, set in the data font */
const dataRow = (field: keyof GearFields, value: string | undefined): ReadoutRow => ({
  ...row(field, value),
  data: true,
})

export function GearDetails({ item }: { readonly item: Gear }) {
  const mount = (value: Gear['mount']) => (value === undefined ? undefined : MOUNT_LABELS[value])
  const format = (value: Gear['sensorFormat']) =>
    value === undefined ? undefined : SENSOR_FORMAT_LABELS[value]
  const autofocus =
    item.adapterAutofocus === undefined ? undefined : item.adapterAutofocus ? 'Yes' : 'No'

  return (
    <div className="lg:columns-2 lg:gap-10">
      <DetailSection
        title="Basics"
        rows={[
          row('category', CATEGORY_LABELS[item.category]),
          row('brand', item.brand),
          row('model', item.model),
          row('nickname', item.nickname),
          dataRow('serialNumber', item.serialNumber),
          row('mount', mount(item.mount)),
          row('sensorFormat', format(item.sensorFormat)),
          row('lensCoverage', format(item.lensCoverage)),
          { label: 'Focal length', value: formatFocalLength(item), data: true },
          { label: 'Aperture', value: formatAperture(item), data: true },
          row('adapterFrom', mount(item.adapterFrom)),
          row('adapterTo', mount(item.adapterTo)),
          row('adapterAutofocus', autofocus),
        ]}
      />
      <DetailSection
        title="Purchase"
        rows={[
          dataRow('purchaseDate', date(item.purchaseDate)),
          dataRow('purchasePrice', money(item.purchasePrice)),
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
          row('status', <StatusDot status={item.status} />),
          row('currentLocation', item.currentLocation),
          dataRow('saleDate', date(item.saleDate)),
          dataRow('salePrice', money(item.salePrice)),
          dataRow('lostDate', date(item.lostDate)),
        ]}
      />
      <DetailSection
        title="Warranty and insurance"
        rows={[
          dataRow('warrantyExpiry', date(item.warrantyExpiry)),
          dataRow('insuredValue', money(item.insuredValue)),
        ]}
      />
      {item.notes !== undefined && (
        <section className="mb-8 break-inside-avoid">
          <h2 className="mb-3 text-base font-semibold">{FIELD_LABELS.notes}</h2>
          {/* pre-wrap keeps the line breaks people typed, while the text stays plain text */}
          <p className="rounded-lg border border-border bg-card p-4 whitespace-pre-wrap">
            {item.notes}
          </p>
        </section>
      )}
      <DetailSection
        title="Record"
        rows={[
          { label: 'Added', value: day(item.createdAt), data: true },
          { label: 'Last changed', value: day(item.updatedAt), data: true },
        ]}
      />
    </div>
  )
}
