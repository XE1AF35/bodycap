// Restoring from a backup file. The file is checked and previewed first, a backup of what's here
// now is offered, and nothing changes until the person confirms. The restore itself is all or
// nothing.
import { useMemo, useState } from 'react'
import type { Backup } from '@/core/backup/format'
import { formatDate, toIsoDate } from '@/core/dates'
import { readBackupFile } from '@/data/backup-file'
import { isStorageFull } from '@/data/storage'
import { BackupButton } from '@/ui/backup/BackupButton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/ui/components/ui/alert-dialog'
import { Button } from '@/ui/components/ui/button'
import { Label } from '@/ui/components/ui/label'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { itemCount } from '@/ui/settings/words'

/** The day the backup was made, where the person is */
const madeOn = (backup: Backup) => formatDate(toIsoDate(new Date(backup.exportedAt)))

export function RestoreSection() {
  const { repositories } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))
  const here = gear.status === 'ready' ? gear.value.length : 0

  const [chosen, setChosen] = useState<Backup>()
  const [problem, setProblem] = useState<string>()
  const [done, setDone] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  // A new key clears the file input once a restore is done
  const [inputKey, setInputKey] = useState(0)

  const choose = async (file: File | undefined) => {
    setChosen(undefined)
    setProblem(undefined)
    setDone('')
    if (file === undefined) return
    const result = await readBackupFile(file)
    if (result.ok) setChosen(result.value)
    else setProblem(result.error)
  }

  const restore = async (backup: Backup) => {
    setBusy(true)
    try {
      await repositories.backup.restore(backup)
      setConfirming(false)
      setChosen(undefined)
      setInputKey((key) => key + 1)
      setDone(
        `Restored ${itemCount(backup.counts.gear)} from the backup made on ${madeOn(backup)}.`,
      )
    } catch (error) {
      setConfirming(false)
      setProblem(
        isStorageFull(error)
          ? 'The browser has run out of space, so nothing was changed.'
          : "The restore didn't work, so nothing was changed. Try again, or choose another backup.",
      )
    } finally {
      setBusy(false)
    }
  }

  const replaces =
    here === 0
      ? "There's no gear here now, so nothing will be lost."
      : `It replaces the ${itemCount(here)} here now, and can't be undone, so you may want a backup of what's here first.`

  return (
    <section
      aria-labelledby="restore-title"
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="restore-title" className="text-base font-semibold">
        Restore
      </h2>
      <p className="max-w-prose text-muted-foreground">
        Restoring replaces everything here with what's in a backup file. You'll see what the file
        holds before anything changes.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="restore-file">Backup file</Label>
        <input
          key={inputKey}
          id="restore-file"
          type="file"
          accept=".json,application/json"
          className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          onChange={(event) => {
            void choose(event.target.files?.[0])
          }}
        />
      </div>

      {problem !== undefined && (
        <p role="alert" className="font-medium text-destructive">
          {problem}
        </p>
      )}
      <p role="status">{done}</p>

      {chosen !== undefined && (
        <div className="grid max-w-prose gap-3 rounded-lg border border-border bg-background p-4">
          <p>
            This backup was made on {madeOn(chosen)} and holds {itemCount(chosen.counts.gear)}.
          </p>
          <p className="text-muted-foreground">{replaces}</p>
          {here > 0 && <BackupButton label="Download a backup of what's here now" />}
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogTrigger render={<Button variant="destructive" className="w-fit" />}>
              Restore this backup
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Replace everything?</AlertDialogTitle>
                <AlertDialogDescription>
                  {here === 0
                    ? `The ${itemCount(chosen.counts.gear)} in the backup will be added.`
                    : `The ${itemCount(here)} here now will be replaced by the ${itemCount(chosen.counts.gear)} in the backup. This can't be undone.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep what's here</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    void restore(chosen)
                  }}
                >
                  Replace everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </section>
  )
}
