// Adding gear to a kit: a searchable list of gear not in it yet. Sold and lost gear is left out,
// since it can't be packed. Ticks survive a search, so items can be gathered from several.
import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { Gear } from '@/core/gear'
import { addToKit, type Kit } from '@/core/kits'
import { filterAndSortGear } from '@/core/search'
import { RuleError } from '@/data/repositories'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { gearName } from '@/ui/gear/labels'
import { FormDialog } from '@/ui/gear/status/FormDialog'
import { useServices } from '@/ui/services'

interface AddGearDialogProps {
  readonly kit: Kit
  readonly gear: readonly Gear[]
}

function GearPicker({ kit, gear, onClose }: AddGearDialogProps & { readonly onClose: () => void }) {
  const { repositories } = useServices()
  const [text, setText] = useState('')
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set())
  const inKit = new Set(kit.gearIds)
  const candidates = filterAndSortGear(
    gear.filter(({ id, status }) => !inKit.has(id) && status !== 'sold' && status !== 'lost'),
    { text },
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
      <div className="grid gap-1.5">
        <Label htmlFor="kit-picker-search">Search</Label>
        <Input
          id="kit-picker-search"
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
          }}
        />
      </div>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing else to add.</p>
      ) : (
        <fieldset>
          <legend className="sr-only">Gear to add</legend>
          <ul className="grid max-h-72 gap-1 overflow-y-auto">
            {candidates.map((item) => (
              <li key={item.id}>
                <label className="flex items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={chosen.has(item.id)}
                    onChange={(event) => {
                      const next = new Set(chosen)
                      if (event.target.checked) next.add(item.id)
                      else next.delete(item.id)
                      setChosen(next)
                    }}
                  />
                  {gearName(item)}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
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
