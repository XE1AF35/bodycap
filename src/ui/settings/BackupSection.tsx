// When the last backup was, how much has changed since, a button to make one, and how soon the
// dashboard reminds about the next. Like the theme, the reminder is kept on this device only.
import { useMemo, useState } from 'react'
import { BACKUP_DUE_CHANGES, BACKUP_DUE_DAYS } from '@/core/alerts'
import { daysBetween, toIsoDate } from '@/core/dates'
import { BackupButton } from '@/ui/backup/BackupButton'
import { Label } from '@/ui/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/ui/components/ui/native-select'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { useChoice } from '@/ui/settings/use-choice'
import { relativeDays } from '@/ui/settings/words'

const REMINDERS: readonly (readonly [number, string])[] = [
  [7, 'A week after the last one'],
  [14, 'Two weeks after the last one'],
  [30, 'A month after the last one'],
]

function changesText(changes: number): string {
  if (changes === 0) return 'No changes since then.'
  return changes === 1 ? '1 change since then.' : `${String(changes)} changes since then.`
}

export function BackupSection() {
  const { repositories } = useServices()
  const settings = useLive(useMemo(() => repositories.settings.get(), [repositories]))
  const photos = useLive(useMemo(() => repositories.photos.count(), [repositories]))
  const [today] = useState(() => toIsoDate(new Date()))
  const savedDays = settings.status === 'ready' ? settings.value.backupReminderDays : undefined
  const reminder = useChoice(String(savedDays ?? BACKUP_DUE_DAYS), (days) =>
    repositories.settings.setBackupReminderDays(Number(days)),
  )

  let status: string[] = []
  if (settings.status === 'ready') {
    const { lastBackupAt, changesSinceBackup } = settings.value
    if (lastBackupAt === undefined) {
      status = ["You haven't made a backup yet."]
    } else {
      // Counted in calendar days where the person is, so last night's backup is "yesterday"
      const days = daysBetween(toIsoDate(new Date(lastBackupAt)), today)
      status = [
        `Last backup: ${relativeDays.format(-days, 'day')}.`,
        changesText(changesSinceBackup),
      ]
    }
  }

  return (
    <section
      aria-labelledby="backup-title"
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="backup-title" className="text-base font-semibold">
        Backup
      </h2>
      <p className="max-w-prose text-muted-foreground">
        A backup is one file holding all your gear: a .json file, or a .zip once there are photos to
        keep too. Keep it somewhere other than this device, such as cloud storage or a USB drive, so
        your gear survives if this browser loses it.
      </p>
      {status.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <BackupButton />
      {photos.status === 'ready' && photos.value > 0 && (
        <div className="grid gap-1.5">
          <BackupButton
            label="Back up without photos"
            withoutPhotos
            hintId="backup-without-photos-hint"
          />
          <p id="backup-without-photos-hint" className="text-sm text-muted-foreground">
            A .json file with everything but the photos, which is much smaller.
          </p>
        </div>
      )}
      <div className="mt-3 grid gap-1.5">
        <Label htmlFor="backup-reminder">Remind me to back up</Label>
        <NativeSelect
          id="backup-reminder"
          value={reminder.shown}
          aria-describedby="backup-reminder-hint"
          onChange={(event) => {
            reminder.choose(event.target.value)
          }}
        >
          {REMINDERS.map(([days, label]) => (
            <NativeSelectOption key={days} value={days}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <p id="backup-reminder-hint" className="text-sm text-muted-foreground">
        Or after {BACKUP_DUE_CHANGES} changes, if that comes first. This is kept on this device
        only.
      </p>
      {reminder.problem !== undefined && (
        <p role="alert" className="font-medium text-destructive">
          {reminder.problem}
        </p>
      )}
    </section>
  )
}
