// The Shoots page's list of held bodies, lenses, flashes, and drones that haven't been on a shoot
// in the past year, each linked to its page, to help decide what to sell. It's only as good as the
// log.
import { Link } from '@tanstack/react-router'
import { useId, useMemo } from 'react'
import { formatDate, type IsoDate } from '@/core/dates'
import { LOCALE } from '@/core/locale'
import type { Shoot } from '@/core/shoots'
import { unusedItems } from '@/core/usage'
import { gearName } from '@/ui/gear/labels'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

const names = new Intl.Collator(LOCALE)

export function UnusedGear({
  shoots,
  today,
}: {
  readonly shoots: readonly Shoot[]
  readonly today: IsoDate
}) {
  const { repositories } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))
  const titleId = useId()
  if (gear.status !== 'ready') return null

  // By name first, so items unused for as long as each other stay in a steady order
  const byName = [...gear.value].sort((a, b) => names.compare(gearName(a), gearName(b)))
  const unused = unusedItems(byName, shoots, today)
  return (
    <section aria-labelledby={titleId} className="mt-8 grid gap-3">
      <h2 id={titleId} className="text-base font-semibold">
        Unused
      </h2>
      <p className="text-sm text-muted-foreground">
        Camera bodies, lenses, flashes, and drones you hold that haven't been on a shoot in the past
        year. This list is based only on the shoots you've logged.
      </p>
      {unused.length === 0 ? (
        <p className="text-sm">
          Every camera body, lens, flash, and drone you hold has been on a shoot in the past year.
        </p>
      ) : (
        <ul className="grid gap-2">
          {unused.map(({ item, usage }) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 rounded-lg border border-border bg-card px-4 py-3"
            >
              <Link
                to="/gear/$gearId"
                params={{ gearId: item.id }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {gearName(item)}
              </Link>
              <span className="text-sm text-muted-foreground">
                {usage.lastUsed === undefined
                  ? 'Never on a logged shoot'
                  : `Last used ${formatDate(usage.lastUsed)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
