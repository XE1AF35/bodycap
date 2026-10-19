// The shoots log: every shoot, newest first, with how many were logged this year.
import { useMemo, useState } from 'react'
import { formatDate, toIsoDate } from '@/core/dates'
import { newestFirst, shootsThisYear } from '@/core/shoots'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { useLive } from '@/ui/hooks/useLive'
import { ShootDialog } from '@/ui/shoots/ShootDialog'
import { useServices } from '@/ui/services'
import { itemCount, shootCount } from '@/ui/settings/words'

export function ShootsPage() {
  const { repositories } = useServices()
  const shoots = useLive(useMemo(() => repositories.shoots.list(), [repositories]))
  const [today] = useState(() => toIsoDate(new Date()))

  if (shoots.status === 'loading') {
    return (
      <Page title="Shoots">
        <p className="text-muted-foreground">Loading your shoots.</p>
      </Page>
    )
  }
  if (shoots.status === 'error') {
    return (
      <Page title="Shoots">
        <p role="alert">Your shoots couldn't be loaded. Reload the page to try again.</p>
      </Page>
    )
  }

  const sorted = newestFirst(shoots.value)
  return (
    <Page title="Shoots" actions={<ShootDialog today={today} />}>
      {sorted.length === 0 ? (
        <EmptyState drawing="viewfinder" title="No shoots yet.">
          A shoot is a time you went out photographing, with the gear you took. Log your shoots to
          see which gear you really use.
        </EmptyState>
      ) : (
        <>
          <p className="text-muted-foreground">{`${shootCount(shootsThisYear(sorted, today))} logged this year.`}</p>
          <ul aria-label="Your shoots" className="grid gap-3">
            {sorted.map((shoot) => (
              <li key={shoot.id} className="grid gap-1 rounded-lg border border-border bg-card p-4">
                <p className="font-medium">{shoot.name}</p>
                <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  <span>{formatDate(shoot.date)}</span>
                  <span>
                    {shoot.gearIds.length === 0 ? 'No items' : itemCount(shoot.gearIds.length)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  )
}
