// Installs Bodycap as an app, shown only while the browser offers to.
import { Download } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { MAIN_ID } from '@/ui/components/SkipLink'
import { Button } from '@/ui/components/ui/button'
import { useServices } from '@/ui/services'

export function InstallButton() {
  const { install } = useServices()
  const offer = useSyncExternalStore(install.subscribe, install.current)
  if (offer === undefined) return null

  return (
    <Button
      variant="outline"
      onClick={() => {
        // The button goes once the offer is used, so focus moves to the page rather than being lost
        document.getElementById(MAIN_ID)?.focus()
        void offer()
      }}
    >
      <Download aria-hidden="true" />
      Install app
    </Button>
  )
}
