// When the last backup was, how much has changed since, and a button to make one.
import { useMemo, useState } from 'react'
import { daysBetween, toIsoDate } from '@/core/dates'
import { BackupButton } from '@/ui/backup/BackupButton'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { relativeDays } from '@/ui/settings/words'

function changesText(changes: number): string {
  if (changes === 0) return 'No changes since then.'
  return changes === 1 ? '1 change since then.' : `${String(changes)} changes since then.`
}

export function BackupSection() {
  const { repositories } = useServices()
  const settings = useLive(useMemo(() => repositories.settings.get(), [repositories]))
  const [today] = useState(() => toIsoDate(new Date()))

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
        A backup is one file holding all your gear. Keep it somewhere other than this device, such
        as cloud storage or a USB drive, so your gear survives if this browser loses it.
      </p>
      {status.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <BackupButton />
    </section>
  )
}
