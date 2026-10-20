// The Money page: what gear cost each calendar year, from purchases, maintenance, and sales.
import { useMemo } from 'react'
import { Page } from '@/ui/components/Page'
import { startingCurrency } from '@/ui/gear/form/currencies'
import { useLive } from '@/ui/hooks/useLive'
import { SpendSection } from '@/ui/money/SpendSection'
import { useServices } from '@/ui/services'

export function MoneyPage() {
  const { repositories } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))
  const maintenance = useLive(useMemo(() => repositories.maintenance.list(), [repositories]))
  const settings = useLive(useMemo(() => repositories.settings.get(), [repositories]))

  if (
    gear.status === 'loading' ||
    maintenance.status === 'loading' ||
    settings.status === 'loading'
  ) {
    return (
      <Page title="Money">
        <p className="text-muted-foreground">Loading your gear.</p>
      </Page>
    )
  }
  if (gear.status === 'error' || maintenance.status === 'error' || settings.status === 'error') {
    return (
      <Page title="Money">
        <p role="alert">Your gear couldn't be loaded. Reload the page to try again.</p>
      </Page>
    )
  }

  return (
    <Page title="Money">
      <SpendSection
        items={gear.value}
        records={maintenance.value}
        first={startingCurrency(settings.value)}
      />
    </Page>
  )
}
