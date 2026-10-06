// The gear list: search, filters, and sort from the address, a count read out politely as it
// changes, and the matching items as a table or cards.
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useMemo } from 'react'
import type { Gear } from '@/core/gear'
import { LOCALE } from '@/core/locale'
import { filterAndSortGear, type SortKey } from '@/core/search'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { buttonVariants } from '@/ui/components/ui/button-variants'
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
  const addGear = (
    <Link to="/gear/new" className={buttonVariants()}>
      <Plus aria-hidden="true" />
      Add gear
    </Link>
  )

  if (all.length === 0) {
    return (
      <Page title="Gear" actions={addGear}>
        <EmptyState drawing="body-cap" title="Nothing on the shelf yet.">
          Add your first camera, lens, or bag, and it will show up here.
        </EmptyState>
      </Page>
    )
  }

  return (
    <Page title="Gear" actions={addGear}>
      <GearFilters search={search} sort={sort} descending={descending} onChange={update} />
      <p role="status" className="mb-3 text-sm text-muted-foreground">
        Showing <span className="font-mono tabular-nums">{counts.format(shown.length)}</span> of{' '}
        <span className="font-mono tabular-nums">{counts.format(all.length)}</span>
      </p>
      {shown.length === 0 ? (
        <EmptyState drawing="viewfinder" title="Nothing in frame.">
          No gear matches these filters. Try fewer filters or a shorter search.
        </EmptyState>
      ) : (
        <>
          <GearTable items={shown} sort={sort} descending={descending} onSort={sortBy} />
          <GearCards items={shown} />
        </>
      )}
    </Page>
  )
}
