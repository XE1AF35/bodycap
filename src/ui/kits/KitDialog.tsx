// Making a kit, or renaming one: a button, and the form while it's open. A new kit opens once it's
// made, ready for gear.
import { useNavigate } from '@tanstack/react-router'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import {
  toKitInput,
  validateKit,
  withDetails,
  type Kit,
  type KitErrors,
  type KitInput,
} from '@/core/kits'
import { Button } from '@/ui/components/ui/button'
import { NotesField, TextField } from '@/ui/gear/form/fields'
import { FormDialog } from '@/ui/gear/status/FormDialog'
import { useServices } from '@/ui/services'

const NAME_ID = 'kit-name'

/** The form, open while it's rendered */
function KitForm({ kit, onClose }: { readonly kit?: Kit; readonly onClose: () => void }) {
  const { repositories } = useServices()
  const navigate = useNavigate()
  const [input, setInput] = useState<KitInput>(() =>
    kit === undefined ? { name: '', description: '' } : toKitInput(kit),
  )
  const [errors, setErrors] = useState<KitErrors>({})
  const set = (field: keyof KitInput) => (value: string) => {
    setInput((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  return (
    <FormDialog
      title={kit === undefined ? 'New kit' : `Edit ${kit.name}`}
      submit={kit === undefined ? 'Create kit' : 'Save'}
      onCancel={onClose}
      onSubmit={async () => {
        const result = validateKit(input)
        if (!result.ok) {
          setErrors(result.error)
          document
            .getElementById(result.error.name === undefined ? 'kit-description' : NAME_ID)
            ?.focus()
          return
        }
        if (kit === undefined) {
          const made = await repositories.kits.add(result.value)
          onClose()
          await navigate({ to: '/kits/$kitId', params: { kitId: made.id } })
        } else {
          await repositories.kits.update(kit.id, (saved) => withDetails(saved, result.value))
          onClose()
        }
      }}
    >
      <TextField
        id={NAME_ID}
        label="Name"
        required
        hint="Such as Wedding, or Travel light."
        value={input.name}
        error={errors.name}
        onChange={set('name')}
      />
      <NotesField
        id="kit-description"
        label="Description"
        value={input.description}
        error={errors.description}
        onChange={set('description')}
      />
    </FormDialog>
  )
}

/** New kit, or Edit for the kit given */
export function KitDialog({ kit }: { readonly kit?: Kit }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant={kit === undefined ? 'default' : 'outline'}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true)
        }}
      >
        {kit === undefined ? <Plus aria-hidden="true" /> : <Pencil aria-hidden="true" />}
        {kit === undefined ? 'New kit' : 'Edit'}
      </Button>
      {open && (
        <KitForm
          {...(kit === undefined ? {} : { kit })}
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
