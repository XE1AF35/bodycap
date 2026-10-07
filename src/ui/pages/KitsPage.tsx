// Every kit, by name, with how much is in it and, for a packing list, how much is packed.
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { LOCALE } from '@/core/locale'
import { packingProgress } from '@/core/kits'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { useLive } from '@/ui/hooks/useLive'
import { KitDialog } from '@/ui/kits/KitDialog'
import { useServices } from '@/ui/services'
import { itemCount } from '@/ui/settings/words'

const names = new Intl.Collator(LOCALE)

export function KitsPage() {
  const { repositories } = useServices()
  const kits = useLive(useMemo(() => repositories.kits.list(), [repositories]))

  if (kits.status === 'loading') {
    return (
      <Page title="Kits">
        <p className="text-muted-foreground">Loading your kits.</p>
      </Page>
    )
  }
  if (kits.status === 'error') {
    return (
      <Page title="Kits">
        <p role="alert">Your kits couldn't be loaded. Reload the page to try again.</p>
      </Page>
    )
  }

  const sorted = [...kits.value].sort((a, b) => names.compare(a.name, b.name))
  return (
    <Page title="Kits" actions={<KitDialog />}>
      {sorted.length === 0 ? (
        <EmptyState drawing="viewfinder" title="No kits yet.">
          A kit is gear you take together, such as everything for a wedding. Turn on its checklist
          to tick things off as you pack.
        </EmptyState>
      ) : (
        <ul aria-label="Your kits" className="grid gap-3 sm:grid-cols-2">
          {sorted.map((kit) => {
            const progress = packingProgress(kit)
            return (
              <li key={kit.id} className="grid gap-1 rounded-lg border border-border bg-card p-4">
                <Link
                  to="/kits/$kitId"
                  params={{ kitId: kit.id }}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {kit.name}
                </Link>
                {kit.description !== undefined && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{kit.description}</p>
                )}
                <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  <span>
                    {kit.gearIds.length === 0 ? 'Nothing in it yet' : itemCount(kit.gearIds.length)}
                  </span>
                  {progress !== undefined && (
                    <span>{`${String(progress.packed)} of ${String(progress.total)} packed`}</span>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </Page>
  )
}
