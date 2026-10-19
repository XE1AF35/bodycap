// Logging a shoot: a button, and the form while it's open. Items of any category can go on a
// shoot, including ones since sold or lost, but not ones still on the wishlist.
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { IsoDate } from '@/core/dates'
import { emptyShootInput } from '@/core/shoots'
import { Button } from '@/ui/components/ui/button'
import { DateField, NotesField, TextField } from '@/ui/gear/form/fields'
import { GearChecklist } from '@/ui/gear/GearChecklist'
import { FormDialog } from '@/ui/gear/status/FormDialog'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { useShootForm } from './use-shoot-form'

/** The form, open while it's rendered */
function ShootForm({ today, onClose }: { readonly today: IsoDate; readonly onClose: () => void }) {
  const { repositories } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))
  const form = useShootForm('shoot', () => emptyShootInput(today))
  const owned =
    gear.status === 'ready' ? gear.value.filter(({ status }) => status !== 'wishlist') : []

  return (
    <FormDialog
      title="Log a shoot"
      submit="Save"
      ready={gear.status === 'ready'}
      onCancel={onClose}
      onSubmit={async () => {
        const fields = form.check(today)
        if (fields === undefined) return
        await repositories.shoots.add(fields)
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

export function ShootDialog({ today }: { readonly today: IsoDate }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true)
        }}
      >
        <Plus aria-hidden="true" />
        Log a shoot
      </Button>
      {open && (
        <ShootForm
          today={today}
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
