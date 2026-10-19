// One shoot's page: its date, the items taken, each linked to its page, and the notes, with
// editing and deleting it.
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { formatDate, toIsoDate } from '@/core/dates'
import type { Gear } from '@/core/gear'
import { kitGear } from '@/core/kits'
import type { Shoot } from '@/core/shoots'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { gearName } from '@/ui/gear/labels'
import { StatusDot } from '@/ui/gear/StatusDot'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { DeleteShootButton } from '@/ui/shoots/DeleteShootButton'
import { ShootDialog } from '@/ui/shoots/ShootDialog'

function BackToShoots() {
  return (
    <Link
      to="/shoots"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to shoots
    </Link>
  )
}

export function ShootPage() {
  const { shootId } = useParams({ from: '/shoots/$shootId' })
  const { repositories } = useServices()
  const shoot = useLive(useMemo(() => repositories.shoots.get(shootId), [repositories, shootId]))
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))

  if (shoot.status === 'loading' || gear.status === 'loading') {
    return <p className="text-muted-foreground">Loading this shoot.</p>
  }
  if (shoot.status === 'error' || gear.status === 'error') {
    return (
      <Page title="Shoot not loaded">
        <p role="alert">This shoot couldn't be loaded. Reload the page to try again.</p>
      </Page>
    )
  }
  if (shoot.value === undefined) {
    return (
      <Page title="Shoot not found">
        <EmptyState
          drawing="out-of-focus"
          title="This shoot isn't here."
          actions={<BackToShoots />}
        >
          It may have been deleted, perhaps in another tab.
        </EmptyState>
      </Page>
    )
  }

  return <ShootView shoot={shoot.value} gear={gear.value} />
}

function ShootView({ shoot, gear }: { readonly shoot: Shoot; readonly gear: readonly Gear[] }) {
  const itemsId = useId()
  const notesId = useId()
  const [today] = useState(() => toIsoDate(new Date()))
  const items = kitGear(shoot, gear)
  return (
    <>
      <BackToShoots />
      <Page
        title={shoot.name}
        description={<p className="text-sm text-muted-foreground">{formatDate(shoot.date)}</p>}
        actions={
          <>
            <ShootDialog today={today} shoot={shoot} />
            <DeleteShootButton shoot={shoot} />
          </>
        }
      >
        <section aria-labelledby={itemsId} className="mb-8">
          <h2 id={itemsId} className="mb-3 text-base font-semibold">
            Items you took
          </h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items on this shoot.</p>
          ) : (
            <ul className="grid gap-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <Link
                    to="/gear/$gearId"
                    params={{ gearId: item.id }}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {gearName(item)}
                  </Link>
                  <StatusDot status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
        {shoot.notes !== undefined && (
          <section aria-labelledby={notesId}>
            <h2 id={notesId} className="mb-3 text-base font-semibold">
              Notes
            </h2>
            <p className="whitespace-pre-wrap">{shoot.notes}</p>
          </section>
        )}
      </Page>
    </>
  )
}
