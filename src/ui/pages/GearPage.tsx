// The gear list: search, filters, and sort from the address, a count read out politely as it
// changes, and the matching items as a table or cards.
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'
import type { Gear } from '@/core/gear'
import { LOCALE } from '@/core/locale'
import { filterAndSortGear, type SortKey } from '@/core/search'
import { Page } from '@/ui/components/Page'
import { GearCards } from '@/ui/gear/GearCards'
import { GearFilters } from '@/ui/gear/GearFilters'
import { GearTable } from '@/ui/gear/GearTable'
import type { GearSearch } from '@/ui/gear/gear-search'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

const counts = new Intl.NumberFormat(LOCALE)
// One shared empty list, so the filtering below isn't redone on every render while loading
const NO_GEAR: readonly Gear[] = []

export function GearPage() {
  const { repositories } = useServices()
  const live = useMemo(() => repositories.gear.list(), [repositories])
  const gear = useLive(live)
  const search = useSearch({ from: '/gear' })
  const navigate = useNavigate({ from: '/gear' })

  const sort = search.sort ?? 'name'
  const descending = search.desc === true
  const all = gear.status === 'ready' ? gear.value : NO_GEAR
  const shown = useMemo(
    () =>
      filterAndSortGear(all, {
        text: search.q,
        category: search.category,
        status: search.status,
        mount: search.mount,
        sort,
        descending,
      }),
    [all, search.q, search.category, search.status, search.mount, sort, descending],
  )

  const update = (changes: Partial<GearSearch>) => {
    void navigate({ search: (previous) => ({ ...previous, ...changes }), replace: true })
  }

  // A second click on the sorted column reverses it. Name, A to Z is the default, so it's left out
  // of the address.
  const sortBy = (key: SortKey) => {
    const reverse = key === sort && !descending
    update({ sort: key === 'name' ? undefined : key, desc: reverse ? true : undefined })
  }

  if (gear.status === 'loading') {
    return (
      <Page title="Gear">
        <p className="text-muted-foreground">Loading your gear.</p>
      </Page>
    )
  }
  if (gear.status === 'error') {
    return (
      <Page title="Gear">
        <p role="alert">Your gear couldn't be loaded. Reload the page to try again.</p>
      </Page>
    )
  }
  if (all.length === 0) {
    return (
      <Page title="Gear">
        <p className="text-muted-foreground">You haven't added any gear yet.</p>
      </Page>
    )
  }

  return (
    <Page title="Gear">
      <GearFilters search={search} sort={sort} descending={descending} onChange={update} />
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        Showing {counts.format(shown.length)} of {counts.format(all.length)}
      </p>
      {shown.length === 0 ? (
        <p>No gear matches these filters.</p>
      ) : (
        <>
          <GearTable items={shown} sort={sort} descending={descending} onSort={sortBy} />
          <GearCards items={shown} />
        </>
      )}
    </Page>
  )
}
