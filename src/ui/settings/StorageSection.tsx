// How much space Bodycap uses, whether the browser has promised to keep its data, and, in plain
// words, how browser storage can be lost and what keeps gear safe.
import { useEffect, useState } from 'react'
import { storageNearlyFull, type StorageState } from '@/core/alerts'
import { formatBytes } from '@/core/bytes'
import { Button } from '@/ui/components/ui/button'
import { useServices } from '@/ui/services'

function Usage({ state }: { readonly state: StorageState }) {
  const { usage, quota } = state
  if (usage === undefined || quota === undefined || quota <= 0) {
    return <p>This browser doesn't say how much space Bodycap is using.</p>
  }
  return (
    <>
      <p>
        Bodycap is using {formatBytes(usage)} of the {formatBytes(quota)} this browser allows it.
      </p>
      <meter
        aria-label="Storage used"
        className="w-full max-w-md"
        min={0}
        max={quota}
        value={usage}
        high={quota * 0.8}
      />
      {storageNearlyFull(state) !== undefined && (
        <p className="font-medium text-destructive">
          Storage is nearly full. Make a backup, then free up some space on this device.
        </p>
      )}
    </>
  )
}

export function StorageSection() {
  const { storage } = useServices()
  const [state, setState] = useState<StorageState>()
  const [answer, setAnswer] = useState('')

  // The browser only answers on request, so this is read once when Settings opens
  useEffect(() => {
    let current = true
    void storage.storageState().then((next) => {
      if (current) setState(next)
    })
    return () => {
      current = false
    }
  }, [storage])

  const ask = async () => {
    const granted = await storage.requestPersistence()
    if (granted === true) {
      setState((previous) => ({ ...previous, persisted: true }))
    } else {
      setAnswer("The browser didn't agree this time. Backups keep your gear safe either way.")
    }
  }

  return (
    <section
      aria-labelledby="storage-title"
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="storage-title" className="text-base font-semibold">
        Storage
      </h2>
      {state === undefined ? (
        <p className="text-muted-foreground">Checking storage.</p>
      ) : (
        <>
          <Usage state={state} />
          {state.persisted === true && <p>This browser has promised to keep Bodycap's data.</p>}
          {state.persisted === false && (
            <>
              <p>
                This browser hasn't promised to keep Bodycap's data yet. That's normal: browsers
                decide based on how a site is used.
              </p>
              <Button
                variant="outline"
                className="w-fit"
                onClick={() => {
                  void ask()
                }}
              >
                Ask the browser to keep it
              </Button>
            </>
          )}
          <p role="status">{answer}</p>
        </>
      )}

      <h3 className="mt-2 font-semibold">How your gear is kept</h3>
      <ul className="grid max-w-prose list-disc gap-1 pl-5 text-muted-foreground">
        <li>Everything is stored in this browser on this device, and nowhere else.</li>
        <li>Clearing this site's data, or all browsing data, deletes it.</li>
        <li>
          If the device runs low on space, the browser may remove all of a site's data at once,
          unless it has promised to keep it.
        </li>
        <li>
          Safari deletes a site's data after 7 days without a visit, unless the site has been added
          to the Home Screen.
        </li>
        <li>On an iPhone or iPad, open Bodycap in Safari, tap Share, then Add to Home Screen.</li>
        <li>Backups are the safety net. Keep the files somewhere other than this device.</li>
      </ul>
    </section>
  )
}
