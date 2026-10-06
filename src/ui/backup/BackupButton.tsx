// Backs everything up to a file in the person's downloads, then says where it went. The message
// sits in a status region that's always present, so screen readers announce it when it changes.
import { useState } from 'react'
import { isStorageFull } from '@/data/storage'
import { saveFile } from '@/ui/backup/save-file'
import { Button } from '@/ui/components/ui/button'
import { useServices } from '@/ui/services'

/** The label can say more where that helps, such as before a restore */
export function BackupButton({ label = 'Back up now' }: { readonly label?: string }) {
  const { repositories } = useServices()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const backUp = async () => {
    setBusy(true)
    try {
      const file = await repositories.backup.create()
      saveFile(file.name, file.text, 'application/json')
      setMessage(`Backup saved as ${file.name}.`)
    } catch (error) {
      setMessage(
        isStorageFull(error)
          ? "The browser has run out of space, so the backup couldn't be made."
          : "The backup couldn't be made. Try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          void backUp()
        }}
      >
        {label}
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  )
}
