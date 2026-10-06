// One item's page: everything recorded about it, and Delete. Edit arrives with the form in step 13.
import { Link, useParams } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Page } from '@/ui/components/Page'
import { DeleteGearButton } from '@/ui/gear/DeleteGearButton'
import { GearDetails } from '@/ui/gear/GearDetails'
import { gearName } from '@/ui/gear/labels'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

function BackToGear() {
  return (
    <Link to="/gear" className="text-sm underline underline-offset-4">
      Back to your gear
    </Link>
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
        <p className="mb-4 text-muted-foreground">
          There's no item here. It may have been deleted, perhaps in another tab.
        </p>
        <BackToGear />
      </Page>
    )
  }

  const item = state.value
  return (
    <Page title={gearName(item)}>
      {item.nickname !== undefined && (
        <p className="-mt-2 mb-4 text-muted-foreground">{item.nickname}</p>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <DeleteGearButton item={item} />
        <BackToGear />
      </div>
      <GearDetails item={item} />
    </Page>
  )
}
