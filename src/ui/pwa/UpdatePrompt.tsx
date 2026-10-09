// Offers a waiting new version of Bodycap. It never reloads by itself, and Later hides it until
// the next visit. When the new version upgrades the database, it suggests a backup first.
import { useId, useState, useSyncExternalStore } from 'react'
import { BackupButton } from '@/ui/backup/BackupButton'
import { Button } from '@/ui/components/ui/button'
import { useServices } from '@/ui/services'

export function UpdatePrompt() {
  const { updates } = useServices()
  const update = useSyncExternalStore(updates.subscribe, updates.current)
  const [later, setLater] = useState(false)
  const labelId = useId()
  if (update === undefined || later) return null

  return (
    <aside
      aria-labelledby={labelId}
      className="fixed right-4 bottom-4 left-4 z-40 print:hidden mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg motion-safe:animate-rise-in sm:left-auto"
    >
      <p id={labelId} className="label-engraved w-full">
        Update
      </p>
      <p role="status" className="-mt-2 w-full">
        {update.changesStorage
          ? 'A new version of Bodycap is ready. It changes how your gear is stored, so back up first, just in case. Then reload to start using it.'
          : 'A new version of Bodycap is ready. Reload to start using it.'}
      </p>
      {update.changesStorage && (
        <div className="w-full">
          <BackupButton label="Back up first" />
        </div>
      )}
      <Button onClick={update.install}>Reload</Button>
      <Button
        variant="ghost"
        onClick={() => {
          setLater(true)
        }}
      >
        Later
      </Button>
    </aside>
  )
}
