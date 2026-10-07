// Logging work on an item, or editing a record already logged: a button, and the form while it's
// open. Costs start in the currency the item was bought in.
import { useState } from 'react'
import { formatDate, type IsoDate } from '@/core/dates'
import type { Gear } from '@/core/gear'
import {
  emptyMaintenanceInput,
  MAINTENANCE_TYPE_LABELS,
  toMaintenanceInput,
  type MaintenanceRecord,
} from '@/core/maintenance'
import { DEFAULT_CURRENCY } from '@/core/money'
import { Button } from '@/ui/components/ui/button'
import { gearName } from '@/ui/gear/labels'
import { FormDialog } from '@/ui/gear/status/FormDialog'
import { useServices } from '@/ui/services'
import { MaintenanceFormFields } from './MaintenanceFormFields'
import { useMaintenanceForm } from './use-maintenance-form'

interface MaintenanceDialogProps {
  readonly item: Gear
  /** The record to edit, or none to log new work */
  readonly record?: MaintenanceRecord
  readonly today: IsoDate
}

function MaintenanceForm({
  item,
  record,
  today,
  onClose,
}: MaintenanceDialogProps & { readonly onClose: () => void }) {
  const { repositories } = useServices()
  const currency = item.purchasePrice?.currency ?? DEFAULT_CURRENCY
  const form = useMaintenanceForm(record === undefined ? 'log' : `edit-${record.id}`, () =>
    record === undefined
      ? emptyMaintenanceInput(today, currency)
      : toMaintenanceInput(record, currency),
  )
  const work =
    record === undefined || record.type === 'other'
      ? 'the work'
      : `the ${MAINTENANCE_TYPE_LABELS[record.type].toLowerCase()}`

  return (
    <FormDialog
      title={
        record === undefined ? `Log work on ${gearName(item)}` : `Edit ${work} on ${gearName(item)}`
      }
      submit="Save"
      onCancel={onClose}
      onSubmit={async () => {
        const details = form.check(today)
        if (details === undefined) return
        if (record === undefined) await repositories.maintenance.add(item.id, details)
        else await repositories.maintenance.update(record.id, details)
        onClose()
      }}
    >
      <MaintenanceFormFields form={form} />
    </FormDialog>
  )
}

export function MaintenanceDialog(props: MaintenanceDialogProps) {
  const [open, setOpen] = useState(false)
  const { record } = props
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true)
        }}
      >
        {record === undefined ? (
          'Log work'
        ) : (
          <>
            {/* Says which record, since every record has an Edit button. The space sits outside
                the hidden text, or the words run together. */}
            Edit{' '}
            <span className="sr-only">
              {`${MAINTENANCE_TYPE_LABELS[record.type]}, ${formatDate(record.date)}`}
            </span>
          </>
        )}
      </Button>
      {open && (
        <MaintenanceForm
          {...props}
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
