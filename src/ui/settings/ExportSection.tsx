// Getting your gear out of Bodycap in other forms: a CSV file for spreadsheets, and the insurance
// list to print. Neither is a backup, since neither can be restored.
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { csvFileName, gearCsv } from '@/core/csv'
import { toIsoDate } from '@/core/dates'
import { filterAndSortGear } from '@/core/search'
import { saveFile } from '@/ui/backup/save-file'
import { Button } from '@/ui/components/ui/button'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

export function ExportSection() {
  const { repositories } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))
  const [message, setMessage] = useState('')

  const download = () => {
    if (gear.status !== 'ready') return
    // In name order, as the gear list shows them
    const csv = gearCsv(filterAndSortGear(gear.value, { sort: 'name' }))
    const name = csvFileName(toIsoDate(new Date()))
    saveFile(name, csv, 'text/csv;charset=utf-8')
    setMessage(`Saved as ${name}.`)
  }

  return (
    <section
      aria-labelledby="export-title"
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="export-title" className="text-base font-semibold">
        Spreadsheet and insurance
      </h2>
      <p className="max-w-prose text-muted-foreground">
        Download your gear as a CSV file for Excel, Numbers, or Google Sheets, or print a list for
        your insurer. Neither is a backup: kits, loans, maintenance, and photos are left out, and
        neither can be restored.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={gear.status !== 'ready'} onClick={download}>
          Download gear as CSV
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      </div>
      <Link to="/insurance" className="w-fit underline underline-offset-4">
        Open the insurance list
      </Link>
    </section>
  )
}
