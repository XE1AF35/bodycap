// Offers a waiting new version of Bodycap. It never reloads by itself, and Later hides it until
// the next visit.
import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/ui/components/ui/button'
import { useServices } from '@/ui/services'

export function UpdatePrompt() {
  const { updates } = useServices()
  const install = useSyncExternalStore(updates.subscribe, updates.current)
  const [later, setLater] = useState(false)
  if (install === undefined || later) return null

  return (
    <aside
      aria-label="Update"
      className="fixed right-4 bottom-4 left-4 z-40 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-4 shadow-lg sm:left-auto"
    >
      <p role="status" className="w-full">
        A new version of Bodycap is ready. Reload to start using it.
      </p>
      <Button onClick={install}>Reload</Button>
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
