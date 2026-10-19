// A searchable list of gear to tick, for choosing several items at once. Ticks survive a search,
// so items can be gathered from several.
import { useState } from 'react'
import type { Gear } from '@/core/gear'
import { filterAndSortGear } from '@/core/search'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { gearName } from '@/ui/gear/labels'

interface GearChecklistProps {
  /** Starts the search field's id, so two lists on a page never share one */
  readonly idPrefix: string
  /** What the ticked items are for, read out by screen readers, such as "Gear to add" */
  readonly legend: string
  readonly gear: readonly Gear[]
  readonly chosen: ReadonlySet<string>
  readonly onChange: (chosen: ReadonlySet<string>) => void
  /** Shown when nothing fits the search, or there's nothing to choose from */
  readonly emptyText: string
}

export function GearChecklist({
  idPrefix,
  legend,
  gear,
  chosen,
  onChange,
  emptyText,
}: GearChecklistProps) {
  const [text, setText] = useState('')
  const candidates = filterAndSortGear(gear, { text })

  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-search`}>Search</Label>
        <Input
          id={`${idPrefix}-search`}
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
          }}
        />
      </div>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <fieldset>
          <legend className="sr-only">{legend}</legend>
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
                      onChange(next)
                    }}
                  />
                  {gearName(item)}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </>
  )
}
