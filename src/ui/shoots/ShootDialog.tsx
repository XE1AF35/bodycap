// Logging a shoot, or editing one: a button, and the form while it's open. Items of any category can
// go on a shoot, including ones since sold or lost, but not ones still on the wishlist. A whole kit
// can be added in one go.
import { Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { IsoDate } from '@/core/dates'
import { emptyShootInput, toShootInput, type Shoot } from '@/core/shoots'
import { Button } from '@/ui/components/ui/button'
import { DateField, NotesField, TextField } from '@/ui/gear/form/fields'
import { GearChecklist } from '@/ui/gear/GearChecklist'
import { FormDialog } from '@/ui/gear/status/FormDialog'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { AddKitField } from './AddKitField'
import { useShootForm } from './use-shoot-form'

interface ShootDialogProps {
  readonly today: IsoDate
  /** The shoot to edit, or nothing to log a new one */
  readonly shoot?: Shoot
}

/** The form, open while it's rendered */
function ShootForm({ today, shoot, onClose }: ShootDialogProps & { readonly onClose: () => void }) {
  const { repositories } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))
  const kits = useLive(useMemo(() => repositories.kits.list(), [repositories]))
  const form = useShootForm('shoot', () =>
    shoot === undefined ? emptyShootInput(today) : toShootInput(shoot),
  )
  const owned =
    gear.status === 'ready' ? gear.value.filter(({ status }) => status !== 'wishlist') : []

  return (
    <FormDialog
      title={shoot === undefined ? 'Log a shoot' : `Edit ${shoot.name}`}
      submit="Save"
      ready={gear.status === 'ready' && kits.status === 'ready'}
      onCancel={onClose}
      onSubmit={async () => {
        const fields = form.check(today)
        if (fields === undefined) return
        if (shoot === undefined) await repositories.shoots.add(fields)
        else await repositories.shoots.update(shoot.id, fields)
        onClose()
      }}
    >
      <DateField {...form.text('date')} label="Date" required />
      <TextField
        {...form.text('name')}
        label="Name"
        required
        hint="Such as Wedding, or Dawn at the beach."
      />
      {kits.status === 'ready' && kits.value.length > 0 && (
        <AddKitField kits={kits.value} gear={owned} chosen={form.gearIds} onAdd={form.addGearIds} />
      )}
      {/* The checklist's own legend names the group for screen readers */}
      <div className="grid gap-3">
        <p aria-hidden="true" className="text-sm font-medium">
          Items you took
        </p>
        <GearChecklist
          idPrefix="shoot-items"
          legend="Items you took"
          gear={owned}
          chosen={form.gearIds}
          onChange={form.setGearIds}
          emptyText="No items to choose."
        />
      </div>
      <NotesField {...form.text('notes')} label="Notes" />
    </FormDialog>
  )
}

/** Log a shoot, or Edit for the shoot given */
export function ShootDialog({ today, shoot }: ShootDialogProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant={shoot === undefined ? 'default' : 'outline'}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true)
        }}
      >
        {shoot === undefined ? <Plus aria-hidden="true" /> : <Pencil aria-hidden="true" />}
        {shoot === undefined ? 'Log a shoot' : 'Edit'}
      </Button>
      {open && (
        <ShootForm
          today={today}
          {...(shoot === undefined ? {} : { shoot })}
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
