// An item's usage, on its page: how many logged shoots it was on and when it was last used.
// Nothing shows for an item on the wishlist, which can't go on a shoot.
import { useId, useMemo } from 'react'
import { formatDate } from '@/core/dates'
import type { Gear } from '@/core/gear'
import { usageOf, type Usage } from '@/core/usage'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { shootCount } from '@/ui/settings/words'

/** Such as "Used on 3 shoots, most recently on 5 Oct 2026." */
function usageText({ count, lastUsed }: Usage): string {
  if (lastUsed === undefined) return "It hasn't been on a logged shoot."
  const when = count === 1 ? 'on' : 'most recently on'
  return `Used on ${shootCount(count)}, ${when} ${formatDate(lastUsed)}.`
}

export function ItemUsage({ item }: { readonly item: Gear }) {
  const { repositories } = useServices()
  const shoots = useLive(
    useMemo(() => repositories.shoots.withGear(item.id), [repositories, item.id]),
  )
  const titleId = useId()
  if (item.status === 'wishlist' || shoots.status !== 'ready') return null

  return (
    <section aria-labelledby={titleId} className="mb-8">
      <h2 id={titleId} className="mb-3 text-base font-semibold">
        Usage
      </h2>
      <p className="text-sm">{usageText(usageOf(item.id, shoots.value))}</p>
    </section>
  )
}
