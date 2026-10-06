// One item's page: a summary under its name, Edit and Delete beside it, and everything recorded
// about it below.
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useMemo } from 'react'
import { CATEGORY_LABELS, type Gear } from '@/core/gear'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { buttonVariants } from '@/ui/components/ui/button-variants'
import { DeleteGearButton } from '@/ui/gear/DeleteGearButton'
import { GearDetails } from '@/ui/gear/GearDetails'
import { MountBadge } from '@/ui/gear/MountBadge'
import { StatusDot } from '@/ui/gear/StatusDot'
import { gearName, mountText } from '@/ui/gear/labels'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

function BackToGear() {
  return (
    <Link to="/gear" className="text-sm underline underline-offset-4">
      Back to your gear
    </Link>
  )
}

/** The item at a glance, under its name: what it's called, where it stands, and its mount */
function Glance({ item }: { readonly item: Gear }) {
  return (
    <ul
      aria-label="At a glance"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"
    >
      {item.nickname !== undefined && <li className="text-foreground">{item.nickname}</li>}
      <li className="text-foreground">
        <StatusDot status={item.status} />
      </li>
      <li>{CATEGORY_LABELS[item.category]}</li>
      {mountText(item) !== undefined && (
        <li>
          <MountBadge gear={item} />
        </li>
      )}
    </ul>
  )
}

export function GearDetailPage() {
  const { gearId } = useParams({ from: '/gear/$gearId' })
  const { repositories } = useServices()
  const live = useMemo(() => repositories.gear.get(gearId), [repositories, gearId])
  const state = useLive(live)

  if (state.status === 'loading') {
    return <p className="text-muted-foreground">Loading this item.</p>
  }
  if (state.status === 'error') {
    return (
      <Page title="Item not loaded">
        <p role="alert" className="mb-4">
          This item couldn't be loaded. Reload the page to try again.
        </p>
        <BackToGear />
      </Page>
    )
  }
  if (state.value === undefined) {
    return (
      <Page title="Item not found">
        <EmptyState drawing="out-of-focus" title="This item isn't here." actions={<BackToGear />}>
          It may have been deleted, perhaps in another tab.
        </EmptyState>
      </Page>
    )
  }

  const item = state.value
  return (
    <>
      <Link
        to="/gear"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to your gear
      </Link>
      <Page
        title={gearName(item)}
        description={<Glance item={item} />}
        actions={
          <>
            <Link
              to="/gear/$gearId/edit"
              params={{ gearId: item.id }}
              className={buttonVariants({ variant: 'outline' })}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Link>
            <DeleteGearButton item={item} />
          </>
        }
      >
        <GearDetails item={item} />
      </Page>
    </>
  )
}
