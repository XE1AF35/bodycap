// Adding gear to a kit: a searchable list of gear not in it yet. Sold and lost gear is left out,
// since it can't be packed.
import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { Gear } from '@/core/gear'
import { addToKit, type Kit } from '@/core/kits'
import { RuleError } from '@/data/repositories'
import { Button } from '@/ui/components/ui/button'
import { GearChecklist } from '@/ui/gear/GearChecklist'
import { FormDialog } from '@/ui/gear/status/FormDialog'
import { useServices } from '@/ui/services'

interface AddGearDialogProps {
  readonly kit: Kit
  readonly gear: readonly Gear[]
}

function GearPicker({ kit, gear, onClose }: AddGearDialogProps & { readonly onClose: () => void }) {
  const { repositories } = useServices()
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set())
  const inKit = new Set(kit.gearIds)
  const packable = gear.filter(
    ({ id, status }) => !inKit.has(id) && status !== 'sold' && status !== 'lost',
  )

  return (
    <FormDialog
      title={`Add gear to ${kit.name}`}
      submit="Add to kit"
      onCancel={onClose}
      onSubmit={async () => {
        if (chosen.size === 0) throw new RuleError('Choose at least one item to add.')
        await repositories.kits.update(kit.id, (saved) => addToKit(saved, [...chosen]))
        onClose()
      }}
    >
      <GearChecklist
        idPrefix="kit-picker"
        legend="Gear to add"
        gear={packable}
        chosen={chosen}
        onChange={setChosen}
        emptyText="Nothing else to add."
      />
    </FormDialog>
  )
}

export function AddGearDialog(props: AddGearDialogProps) {
  const [open, setOpen] = useState(false)
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
        <Plus aria-hidden="true" />
        Add gear
      </Button>
      {open && (
        <GearPicker
          {...props}
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
