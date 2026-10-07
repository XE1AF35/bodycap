// On a lens's page, how it works with each camera you have, and on a body's page, with each lens:
// as it is, through an adapter you own, with an adapter you'd need, or not at all. Each answer is
// in words, with a dot that only helps the eye.
import { Link } from '@tanstack/react-router'
import { useId, useMemo } from 'react'
import { compatibleGear } from '@/core/compatibility'
import type { Gear } from '@/core/gear'
import { describeFit, FIT_DOTS } from '@/ui/gear/fit-words'
import { gearName } from '@/ui/gear/labels'
import { useLive } from '@/ui/hooks/useLive'
import { cn } from '@/ui/lib/utils'
import { useServices } from '@/ui/services'

export function CompatibilityPanel({ item }: { readonly item: Gear }) {
  const { repositories } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))
  const titleId = useId()
  if (gear.status !== 'ready') return null
  const matches = compatibleGear(item, gear.value)
  if (matches === undefined) return null

  const isLens = item.category === 'lens'
  const others = isLens ? 'cameras' : 'lenses'
  const adapters = new Map(gear.value.map((other) => [other.id, other]))

  return (
    <section aria-labelledby={titleId} className="mb-8">
      <h2 id={titleId} className="mb-3 text-base font-semibold">
        Works with your {others}
      </h2>
      {item.mount === undefined ? (
        <p className="text-sm text-muted-foreground">
          Add its mount to see which of your {others} it works with.
        </p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">You don't have any {others} in Bodycap yet.</p>
      ) : (
        <ul className="grid max-w-2xl gap-1.5">
          {matches.map(({ gear: other, result }) => (
            <li key={other.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <Link
                to="/gear/$gearId"
                params={{ gearId: other.id }}
                className="underline-offset-4 hover:underline"
              >
                {gearName(other)}
              </Link>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className={cn('size-2 shrink-0 rounded-full', FIT_DOTS[result.fit])} />
                {describeFit(result, isLens ? item : other, adapters)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
