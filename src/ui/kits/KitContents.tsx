// What's in a kit. With the packing checklist on, each item gets a tick, and tapping its name
// ticks it, as you would while packing. Removing an item takes it out of the kit, not your gear.
import { Link } from '@tanstack/react-router'
import { useId, useRef, useState } from 'react'
import type { Gear } from '@/core/gear'
import { kitGear, removeFromKit, setPacked, type Kit, type KitFields } from '@/core/kits'
import type { KitChange } from '@/ui/kits/use-kit-changes'
import { Button } from '@/ui/components/ui/button'
import { gearName } from '@/ui/gear/labels'
import { MountBadge } from '@/ui/gear/MountBadge'
import { saveProblem } from '@/ui/gear/save-problem'
import { StatusDot } from '@/ui/gear/StatusDot'

interface KitContentsProps {
  readonly kit: Kit
  readonly gear: readonly Gear[]
  /** Applies a change at once and saves it */
  readonly onChange: KitChange
}

export function KitContents({ kit, gear, onChange }: KitContentsProps) {
  const titleId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [problem, setProblem] = useState<string>()
  const items = kitGear(kit, gear)
  const packed = new Set(kit.packedGearIds)

  const change = async (apply: (saved: Kit) => KitFields) => {
    try {
      setProblem(undefined)
      await onChange(apply)
    } catch (error) {
      setProblem(saveProblem(error))
    }
  }

  return (
    <section aria-labelledby={titleId} className="mb-8">
      {/* Focusable from script, for after an item is removed and its button goes with it */}
      <h2
        id={titleId}
        ref={headingRef}
        tabIndex={-1}
        className="mb-3 text-base font-semibold outline-none"
      >
        In this kit
      </h2>
      {problem !== undefined && (
        <p role="alert" className="mb-3 text-sm font-medium text-destructive">
          {problem}
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in this kit yet.</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              {kit.checklist ? (
                <label className="flex min-w-0 items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={packed.has(item.id)}
                    onChange={(event) => {
                      const { checked } = event.target
                      void change((saved) => setPacked(saved, item.id, checked))
                    }}
                  />
                  {gearName(item)}
                </label>
              ) : (
                <Link
                  to="/gear/$gearId"
                  params={{ gearId: item.id }}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {gearName(item)}
                </Link>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <StatusDot status={item.status} />
                <MountBadge gear={item} />
                {kit.checklist && (
                  <Link
                    to="/gear/$gearId"
                    params={{ gearId: item.id }}
                    className="underline underline-offset-4"
                  >
                    {/* The space sits outside the hidden text, or the words run together */}
                    View <span className="sr-only">{gearName(item)}</span>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void change((saved) => removeFromKit(saved, item.id)).then(() => {
                      headingRef.current?.focus()
                    })
                  }}
                >
                  Remove <span className="sr-only">{gearName(item)}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
