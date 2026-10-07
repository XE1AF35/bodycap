// Marking an item as lost, on the day it went missing.
import { useState } from 'react'
import { DateField } from '@/ui/gear/form/fields'
import { gearName } from '@/ui/gear/labels'
import { useServices } from '@/ui/services'
import { forFields, type ChangeProps } from './change-props'
import { FormDialog } from './FormDialog'
import { saveStatusChange } from './status-change'

const DATE_ID = 'lost-lostDate'

export function LostDialog({ item, today, finalFocus, onDone }: ChangeProps) {
  const { repositories } = useServices()
  const [lostDate, setLostDate] = useState(today)
  const [error, setError] = useState<string>()

  return (
    <FormDialog
      trigger="Lost"
      title={`${gearName(item)} is lost`}
      description="It stays in your records, marked as lost, in case it turns up."
      submit="Mark as lost"
      finalFocus={finalFocus}
      onOpen={() => {
        setLostDate(today)
        setError(undefined)
      }}
      onSubmit={async () => {
        const change = { to: 'lost', lostDate } as const
        const found = await saveStatusChange(repositories.gear, item, change, today)
        if (found === undefined) {
          onDone('Marked as lost.')
          return true
        }
        setError(forFields(found, ['lostDate']).lostDate)
        document.getElementById(DATE_ID)?.focus()
        return false
      }}
    >
      <DateField
        id={DATE_ID}
        label="Date lost"
        value={lostDate}
        error={error}
        onChange={(value) => {
          setLostDate(value)
          setError(undefined)
        }}
      />
    </FormDialog>
  )
}
