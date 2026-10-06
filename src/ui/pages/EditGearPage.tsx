// Editing an item. The form starts from the item as it first loaded and keeps what's typed, even
// if the item changes or goes in another tab meanwhile: saving then explains what happened.
import { Link, useParams } from '@tanstack/react-router'
import { useMemo } from 'react'
import { toGearInput } from '@/core/gear'
import { DEFAULT_CURRENCY } from '@/core/money'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { buttonVariants } from '@/ui/components/ui/button-variants'
import { GearForm } from '@/ui/gear/form/GearForm'
import { gearName } from '@/ui/gear/labels'
import { firstValue, useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

export function EditGearPage() {
  const { gearId } = useParams({ from: '/gear/$gearId/edit' })
  const { repositories } = useServices()
  const item = useLive(
    useMemo(() => firstValue(repositories.gear.get(gearId)), [repositories, gearId]),
  )
  const settings = useLive(useMemo(() => firstValue(repositories.settings.get()), [repositories]))

  if (item.status === 'loading' || settings.status === 'loading') {
    return <p className="text-muted-foreground">Loading the form.</p>
  }
  if (item.status === 'error' || item.value === undefined) {
    return (
      <Page title="Item not found">
        <EmptyState
          drawing="out-of-focus"
          title="This item isn't here to edit."
          actions={
            <Link to="/gear" className="text-sm underline underline-offset-4">
              Back to your gear
            </Link>
          }
        >
          It may have been deleted, perhaps in another tab.
        </EmptyState>
      </Page>
    )
  }

  const saved = item.value
  const currency =
    settings.status === 'ready'
      ? (settings.value.lastUsedCurrency ?? DEFAULT_CURRENCY)
      : DEFAULT_CURRENCY

  return (
    <Page title={`Edit ${gearName(saved)}`}>
      <GearForm
        key={saved.id}
        initial={toGearInput(saved, currency)}
        saved={saved}
        onSave={(fields) => repositories.gear.update(saved.id, fields)}
        cancel={
          <Link
            to="/gear/$gearId"
            params={{ gearId: saved.id }}
            className={buttonVariants({ variant: 'ghost' })}
          >
            Cancel
          </Link>
        }
      />
    </Page>
  )
}
