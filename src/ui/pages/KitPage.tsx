// One kit's page: its gear, adding more, sharing it as a link, and, with the packing checklist on, ticking things off as
// they're packed and unpacking everything for the next trip.
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import type { Gear } from '@/core/gear'
import { packingProgress, resetPacking, setChecklist, type Kit } from '@/core/kits'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { Button } from '@/ui/components/ui/button'
import { useLive } from '@/ui/hooks/useLive'
import { AddGearDialog } from '@/ui/kits/AddGearDialog'
import { DeleteKitButton } from '@/ui/kits/DeleteKitButton'
import { KitContents } from '@/ui/kits/KitContents'
import { KitDialog } from '@/ui/kits/KitDialog'
import { ShareKitDialog } from '@/ui/kits/ShareKitDialog'
import { useKitChanges } from '@/ui/kits/use-kit-changes'
import { useServices } from '@/ui/services'

function BackToKits() {
  return (
    <Link
      to="/kits"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to kits
    </Link>
  )
}

export function KitPage() {
  const { kitId } = useParams({ from: '/kits/$kitId' })
  const { repositories } = useServices()
  const kit = useLive(useMemo(() => repositories.kits.get(kitId), [repositories, kitId]))
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))

  if (kit.status === 'loading' || gear.status === 'loading') {
    return <p className="text-muted-foreground">Loading this kit.</p>
  }
  if (kit.status === 'error' || gear.status === 'error') {
    return (
      <Page title="Kit not loaded">
        <p role="alert">This kit couldn't be loaded. Reload the page to try again.</p>
      </Page>
    )
  }
  if (kit.value === undefined) {
    return (
      <Page title="Kit not found">
        <EmptyState drawing="out-of-focus" title="This kit isn't here." actions={<BackToKits />}>
          It may have been deleted, perhaps in another tab.
        </EmptyState>
      </Page>
    )
  }

  return <KitView saved={kit.value} gear={gear.value} />
}

/** The kit once it's loaded, showing changes as soon as they're made */
function KitView({ saved, gear }: { readonly saved: Kit; readonly gear: readonly Gear[] }) {
  const { kit: shown, change } = useKitChanges(saved)
  const progress = packingProgress(shown)
  return (
    <>
      <BackToKits />
      <Page
        title={saved.name}
        description={
          saved.description === undefined ? undefined : (
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{saved.description}</p>
          )
        }
        actions={
          <>
            <ShareKitDialog kit={saved} gear={gear} />
            <KitDialog kit={saved} />
            <DeleteKitButton kit={saved} />
          </>
        }
      >
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={shown.checklist}
              onChange={(event) => {
                const { checked } = event.target
                void change((current) => setChecklist(current, checked))
              }}
            />
            Use as a packing checklist
          </label>
          {progress !== undefined && (
            <>
              <p role="status" className="text-sm">
                {`${String(progress.packed)} of ${String(progress.total)} packed`}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={progress.packed === 0}
                onClick={() => {
                  void change(resetPacking)
                }}
              >
                Unpack all
              </Button>
            </>
          )}
          <AddGearDialog kit={saved} gear={gear} />
        </div>
        <KitContents kit={shown} gear={gear} onChange={change} />
      </Page>
    </>
  )
}
