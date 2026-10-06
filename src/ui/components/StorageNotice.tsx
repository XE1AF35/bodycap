// Tells the person when storage can't be used, as soon as it happens, since saving would fail.
import { useSyncExternalStore } from 'react'
import type { ConnectionProblem } from '@/data/connection'
import { Button } from '@/ui/components/ui/button'
import { useServices } from '@/ui/services'

const MESSAGES: Record<ConnectionProblem, string> = {
  unavailable:
    "Bodycap can't save anything in this browser window. Private windows often block storage, so try a normal window.",
  'updated-elsewhere': 'Bodycap was updated in another tab. Reload to carry on.',
  'update-blocked': 'Close other Bodycap tabs to finish updating.',
}

export function StorageNotice() {
  const { connection } = useServices()
  const problem = useSyncExternalStore(connection.subscribe, connection.current)
  if (problem === undefined) return null

  return (
    <div
      role="alert"
      className="mb-6 flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground motion-safe:animate-rise-in"
    >
      {/* The red dot that marks alerts, beside the first line */}
      <span className="mt-2 size-2 shrink-0 rounded-full bg-signal" />
      <p className="min-w-0 flex-1">{MESSAGES[problem]}</p>
      {problem === 'updated-elsewhere' && (
        <Button
          variant="outline"
          onClick={() => {
            window.location.reload()
          }}
        >
          Reload
        </Button>
      )}
    </div>
  )
}
