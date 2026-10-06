// Adding an item. Amounts start in the currency used last, or NZD.
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { emptyGearInput } from '@/core/gear'
import { DEFAULT_CURRENCY } from '@/core/money'
import { Page } from '@/ui/components/Page'
import { buttonVariants } from '@/ui/components/ui/button-variants'
import { GearForm } from '@/ui/gear/form/GearForm'
import { firstValue, useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

export function AddGearPage() {
  const { repositories } = useServices()
  const settings = useLive(useMemo(() => firstValue(repositories.settings.get()), [repositories]))

  if (settings.status === 'loading') {
    return <p className="text-muted-foreground">Loading the form.</p>
  }
  // If settings can't be read, the form still works, just starting in NZD
  const currency =
    settings.status === 'ready'
      ? (settings.value.lastUsedCurrency ?? DEFAULT_CURRENCY)
      : DEFAULT_CURRENCY

  return (
    <Page title="Add gear">
      <GearForm
        initial={emptyGearInput(currency)}
        onSave={(fields) => repositories.gear.add(fields)}
        cancel={
          <Link to="/gear" className={buttonVariants({ variant: 'ghost' })}>
            Cancel
          </Link>
        }
      />
    </Page>
  )
}
