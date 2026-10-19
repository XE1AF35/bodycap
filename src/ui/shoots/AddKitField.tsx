// Adding a whole kit to a shoot in one go: pick the kit, and every item in it that isn't on the
// shoot yet gets ticked, ready to untick any that stayed home.
import { useState } from 'react'
import type { Gear } from '@/core/gear'
import { kitGear, type Kit } from '@/core/kits'
import { Button } from '@/ui/components/ui/button'
import { SelectField } from '@/ui/gear/form/fields'
import { itemCount } from '@/ui/settings/words'

const KIT_ID = 'shoot-kit'

interface AddKitFieldProps {
  readonly kits: readonly Kit[]
  /** The items that can go on the shoot */
  readonly gear: readonly Gear[]
  /** The items ticked so far */
  readonly chosen: ReadonlySet<string>
  readonly onAdd: (gearIds: readonly string[]) => void
}

export function AddKitField({ kits, gear, chosen, onAdd }: AddKitFieldProps) {
  const [kitId, setKitId] = useState('')
  const [error, setError] = useState<string>()
  const [added, setAdded] = useState<string>()

  return (
    <div className="grid gap-3">
      <SelectField
        id={KIT_ID}
        label="Kit"
        hint="Ticks every item in the kit that isn't ticked yet."
        value={kitId}
        error={error}
        emptyLabel="Choose a kit"
        choices={kits.map(({ id, name }) => [id, name] as const)}
        onChange={(value) => {
          setKitId(value)
          setError(undefined)
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const kit = kits.find(({ id }) => id === kitId)
            if (kit === undefined) {
              setError('Choose a kit to add.')
              document.getElementById(KIT_ID)?.focus()
              return
            }
            const adding = kitGear(kit, gear)
              .map(({ id }) => id)
              .filter((id) => !chosen.has(id))
            onAdd(adding)
            setAdded(`Added ${itemCount(adding.length)} from ${kit.name}.`)
          }}
        >
          Add its items
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {added}
        </p>
      </div>
    </div>
  )
}
