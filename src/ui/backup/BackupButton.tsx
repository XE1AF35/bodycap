// Backs everything up to a file in the person's downloads, then says where it went: a .zip once
// there are photos to keep, and a .json until then, or whenever photos are left out. The message
// sits in a status region that's always present, so screen readers announce it when it changes.
import { useMemo, useState } from 'react'
import { isStorageFull } from '@/data/storage'
import { saveFile } from '@/ui/backup/save-file'
import { Button } from '@/ui/components/ui/button'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

interface BackupButtonProps {
  /** The label can say more where that helps, such as before a restore */
  readonly label?: string
  /** Makes a .json, however many photos there are */
  readonly withoutPhotos?: boolean
  /** The ID of a hint that says more about what it makes */
  readonly hintId?: string
}

export function BackupButton({
  label = 'Back up now',
  withoutPhotos = false,
  hintId,
}: BackupButtonProps) {
  const { repositories } = useServices()
  const photos = useLive(useMemo(() => repositories.photos.count(), [repositories]))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const backUp = async (withPhotos: boolean) => {
    setBusy(true)
    try {
      if (withPhotos) {
        setMessage('Packing your photos into the backup.')
        const archive = await repositories.backup.createZip()
        saveFile(archive.name, archive.blob, 'application/zip')
        setMessage(`Backup saved as ${archive.name}.`)
      } else {
        const file = await repositories.backup.create()
        saveFile(file.name, file.text, 'application/json')
        setMessage(`Backup saved as ${file.name}.`)
      }
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
        // Until the photos are counted, it can't tell which file to make
        disabled={busy || photos.status === 'loading'}
        aria-describedby={hintId}
        onClick={() => {
          void backUp(!withoutPhotos && photos.status === 'ready' && photos.value > 0)
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
