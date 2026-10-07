// The maintenance form's fields. The firmware version only shows for a firmware update, and the
// rules drop it otherwise, so a version left over from changing the type is never saved.
import { MAINTENANCE_TYPE_LABELS, MAINTENANCE_TYPES } from '@/core/maintenance'
import { DateField, MoneyField, NotesField, SelectField, TextField } from '@/ui/gear/form/fields'
import type { MaintenanceForm } from './use-maintenance-form'

const TYPE_CHOICES = MAINTENANCE_TYPES.map((type) => [type, MAINTENANCE_TYPE_LABELS[type]] as const)

export function MaintenanceFormFields({ form }: { readonly form: MaintenanceForm }) {
  return (
    <>
      <SelectField
        {...form.text('type')}
        label="What was done"
        required
        emptyLabel="Choose one"
        choices={TYPE_CHOICES}
      />
      <DateField {...form.text('date')} label="Date" />
      <MoneyField {...form.cost} label="Cost" hint="Leave it blank if it cost nothing." />
      <TextField
        {...form.text('provider')}
        label="Who did it"
        hint="Such as a repair shop, or you."
      />
      {form.input.type === 'firmware-update' && (
        <TextField {...form.text('firmwareVersion')} label="Firmware version" kind="code" />
      )}
      <NotesField {...form.text('notes')} label="Notes" />
    </>
  )
}
