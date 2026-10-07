// The dashboard: what needs attention, counts by status, value, and the last backup. With no gear
// yet, a welcome takes its place.
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { collectAlerts, type StorageState } from '@/core/alerts'
import { toIsoDate } from '@/core/dates'
import { Page } from '@/ui/components/Page'
import { buttonVariants } from '@/ui/components/ui/button-variants'
import { AttentionList } from '@/ui/dashboard/AttentionList'
import { BackupStatus } from '@/ui/dashboard/BackupStatus'
import { OnLoan } from '@/ui/dashboard/OnLoan'
import { StatusCounts } from '@/ui/dashboard/StatusCounts'
import { ValueSummary } from '@/ui/dashboard/ValueSummary'
import { Welcome } from '@/ui/dashboard/Welcome'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

export function DashboardPage() {
  const { repositories, storage } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))
  const settings = useLive(useMemo(() => repositories.settings.get(), [repositories]))
  const loans = useLive(useMemo(() => repositories.loans.list(), [repositories]))
  const [storageState, setStorageState] = useState<StorageState>({})
  // Read once when the dashboard opens, which is close enough for alerts counted in days
  const [today] = useState(() => toIsoDate(new Date()))

  // The browser only answers on request, so this is read once when the dashboard opens
  useEffect(() => {
    let current = true
    void storage.storageState().then((state) => {
      if (current) setStorageState(state)
    })
    return () => {
      current = false
    }
  }, [storage])

  if (gear.status === 'loading' || settings.status === 'loading' || loans.status === 'loading') {
    return <p className="text-muted-foreground">Loading your gear.</p>
  }
  if (gear.status === 'error' || settings.status === 'error' || loans.status === 'error') {
    return (
      <Page title="Dashboard">
        <p role="alert">Your gear couldn't be loaded. Reload the page to try again.</p>
      </Page>
    )
  }
  if (gear.value.length === 0) return <Welcome />

  const { lastBackupAt, changesSinceBackup, lastUsedCurrency } = settings.value
  // The last backup counts by the day it was made where the person is, like "today"
  const lastBackupOn = lastBackupAt === undefined ? undefined : toIsoDate(new Date(lastBackupAt))
  const alerts = collectAlerts(
    {
      items: gear.value,
      loans: loans.value,
      backup: { lastBackupOn, changesSinceBackup },
      storage: storageState,
    },
    today,
  )

  return (
    <Page
      title="Dashboard"
      actions={
        <Link to="/gear/new" className={buttonVariants()}>
          <Plus aria-hidden="true" />
          Add gear
        </Link>
      }
    >
      {alerts.length > 0 && <AttentionList alerts={alerts} items={gear.value} />}
      <StatusCounts items={gear.value} />
      <OnLoan loans={loans.value} items={gear.value} today={today} />
      <div className="grid gap-x-10 lg:grid-cols-[3fr_2fr]">
        <ValueSummary items={gear.value} first={lastUsedCurrency} />
        <BackupStatus
          lastBackupOn={lastBackupOn}
          changesSinceBackup={changesSinceBackup}
          today={today}
        />
      </div>
    </Page>
  )
}
