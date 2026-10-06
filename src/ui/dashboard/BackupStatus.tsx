// When the last backup was and how much has changed since, as a readout, with a button to make
// one. It's always on the dashboard, since a backup is the only copy of gear outside this browser.
import { daysBetween, type IsoDate } from '@/core/dates'
import { LOCALE } from '@/core/locale'
import { BackupButton } from '@/ui/backup/BackupButton'
import { Readout, type ReadoutRow } from '@/ui/components/Readout'
import { relativeDays } from '@/ui/settings/words'

const count = new Intl.NumberFormat(LOCALE)

interface BackupStatusProps {
  /** The day of the last backup where the person is, or undefined if there's never been one */
  readonly lastBackupOn: IsoDate | undefined
  readonly changesSinceBackup: number
  readonly today: IsoDate
}

export function BackupStatus({ lastBackupOn, changesSinceBackup, today }: BackupStatusProps) {
  const rows: ReadoutRow[] =
    lastBackupOn === undefined
      ? [{ label: 'Last backup', value: 'Never' }]
      : [
          {
            label: 'Last backup',
            value: relativeDays.format(-daysBetween(lastBackupOn, today), 'day'),
          },
          { label: 'Changes since', value: count.format(changesSinceBackup), data: true },
        ]
  return (
    <section aria-labelledby="backup-title" className="mb-8 grid content-start gap-3">
      <h2 id="backup-title" className="text-base font-semibold">
        Backup
      </h2>
      <Readout rows={rows} />
      <BackupButton />
    </section>
  )
}
