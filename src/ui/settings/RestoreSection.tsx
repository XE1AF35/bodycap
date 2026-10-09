// Restoring from a backup file, either in place of everything here or merged into it. The file is
// checked and previewed first, a backup of what's here now is offered, and nothing changes until
// the person confirms. Either way, the restore itself is all or nothing.
import { useMemo, useState } from 'react'
import type { Backup } from '@/core/backup/format'
import { formatDate, toIsoDate } from '@/core/dates'
import { readBackupFile } from '@/data/backup-file'
import { RuleError, type MergeSummary, type RestorableBackup } from '@/data/repositories'
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
import { gearAndPhotos, photoCount, recordCounts } from '@/ui/settings/words'

type Mode = 'replace' | 'merge'

const MODES: readonly (readonly [Mode, string])[] = [
  ['replace', 'Replace everything here'],
  ['merge', "Add to what's here"],
]

/** The day the backup was made, where the person is */
const madeOn = (backup: Backup) => formatDate(toIsoDate(new Date(backup.exportedAt)))

/** Such as "2 items and 5 photos" */
const holds = ({ counts }: Backup) => gearAndPhotos(counts.gear, counts.photos)

/** Such as "Merged the backup made on 5 Oct 2026. Added 2 items. Updated 1 kit." */
function mergedText(backup: Backup, { added, updated }: MergeSummary): string {
  const addedText = recordCounts(added)
  const updatedText = recordCounts(updated)
  const changes: string[] = []
  if (addedText !== undefined) changes.push(`Added ${addedText}.`)
  if (updatedText !== undefined) changes.push(`Updated ${updatedText}.`)
  if (changes.length === 0) changes.push('Everything in it was already here.')
  return [`Merged the backup made on ${madeOn(backup)}.`, ...changes].join(' ')
}

/** What went wrong, in plain words, with the reassurance that nothing changed */
function restoreProblem(error: unknown): string {
  // Written for the person already, such as two loans of one item that can't both be kept
  if (error instanceof RuleError) return error.message
  if (isStorageFull(error)) return 'The browser has run out of space, so nothing was changed.'
  return "The restore didn't work, so nothing was changed. Try again, or choose another backup."
}

export function RestoreSection() {
  const { repositories } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))
  const photos = useLive(useMemo(() => repositories.photos.count(), [repositories]))
  const here = gear.status === 'ready' ? gear.value.length : 0
  const photosHere = photos.status === 'ready' ? photos.value : 0

  const [chosen, setChosen] = useState<RestorableBackup>()
  const [mode, setMode] = useState<Mode>('replace')
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

  const restore = async (backup: RestorableBackup) => {
    setBusy(true)
    try {
      if (mode === 'merge') {
        setDone(mergedText(backup, await repositories.backup.merge(backup)))
      } else {
        await repositories.backup.restore(backup)
        setDone(`Restored ${holds(backup)} from the backup made on ${madeOn(backup)}.`)
      }
      setChosen(undefined)
      setInputKey((key) => key + 1)
    } catch (error) {
      setProblem(restoreProblem(error))
    } finally {
      setConfirming(false)
      setBusy(false)
    }
  }

  const hereNow = gearAndPhotos(here, photosHere)
  const replaces =
    here === 0
      ? "There's no gear here now, so nothing will be lost."
      : `It replaces the ${hereNow} here now, and can't be undone, so you may want a backup of what's here first.`
  // A .json backup leaves photos out, which is easy to forget when restoring one
  const photosGo =
    chosen?.counts.photos === 0 && photosHere > 0
      ? ` This backup has no photos, so the ${photoCount(photosHere)} here will go too.`
      : ''

  return (
    <section
      aria-labelledby="restore-title"
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="restore-title" className="text-base font-semibold">
        Restore
      </h2>
      <p className="max-w-prose text-muted-foreground">
        Restoring brings back what's in a backup file, either in place of everything here or added
        to it. You'll see what the file holds before anything changes.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="restore-file">Backup file</Label>
        <input
          key={inputKey}
          id="restore-file"
          type="file"
          accept=".json,.zip,application/json,application/zip"
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
            This backup was made on {madeOn(chosen)} and holds {holds(chosen)}.
          </p>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">How to restore it</legend>
            {MODES.map(([choice, label]) => (
              <div key={choice} className="flex items-center gap-2">
                <input
                  id={`restore-${choice}`}
                  type="radio"
                  name="restore-mode"
                  className="size-4 accent-primary"
                  checked={mode === choice}
                  onChange={() => {
                    setMode(choice)
                  }}
                />
                <label htmlFor={`restore-${choice}`}>{label}</label>
              </div>
            ))}
          </fieldset>
          {mode === 'replace' ? (
            <p className="text-muted-foreground">
              {replaces}
              {photosGo}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Anything only in the backup is added, and anything the backup has a newer copy of is
              updated. Nothing here is removed. Anything deleted here since the backup was made
              comes back.
            </p>
          )}
          {here > 0 && <BackupButton label="Download a backup of what's here now" />}
          <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogTrigger
              render={
                <Button
                  variant={mode === 'replace' ? 'destructive' : 'default'}
                  className="w-fit"
                />
              }
            >
              Restore this backup
            </AlertDialogTrigger>
            <AlertDialogContent>
              {mode === 'replace' ? (
                <AlertDialogHeader>
                  <AlertDialogTitle>Replace everything?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {here === 0
                      ? `The ${holds(chosen)} in the backup will be added.`
                      : `The ${hereNow} here now will be replaced by the ${holds(chosen)} in the backup. This can't be undone.${photosGo}`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
              ) : (
                <AlertDialogHeader>
                  <AlertDialogTitle>Merge this backup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    What's in the backup will be added to what's here. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {mode === 'replace' ? "Keep what's here" : "Don't merge"}
                </AlertDialogCancel>
                <AlertDialogAction
                  variant={mode === 'replace' ? 'destructive' : 'default'}
                  disabled={busy}
                  onClick={() => {
                    void restore(chosen)
                  }}
                >
                  {mode === 'replace' ? 'Replace everything' : 'Merge'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </section>
  )
}
