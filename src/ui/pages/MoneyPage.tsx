// The Money page: what gear cost each calendar year, from purchases, maintenance, and sales, and what
// the gear you have is probably worth now.
import { useMemo, useState } from 'react'
import { toIsoDate } from '@/core/dates'
import { Page } from '@/ui/components/Page'
import { startingCurrency } from '@/ui/gear/form/currencies'
import { useLive } from '@/ui/hooks/useLive'
import { EstimateSection } from '@/ui/money/EstimateSection'
import { SpendSection } from '@/ui/money/SpendSection'
import { useServices } from '@/ui/services'

export function MoneyPage() {
  const { repositories } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))
  const maintenance = useLive(useMemo(() => repositories.maintenance.list(), [repositories]))
  const settings = useLive(useMemo(() => repositories.settings.get(), [repositories]))
  const [today] = useState(() => toIsoDate(new Date()))

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

  const first = startingCurrency(settings.value)
  return (
    <Page title="Money">
      <SpendSection items={gear.value} records={maintenance.value} first={first} />
      <EstimateSection items={gear.value} today={today} first={first} />
    </Page>
  )
}
