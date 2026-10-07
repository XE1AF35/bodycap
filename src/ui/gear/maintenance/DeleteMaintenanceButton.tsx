// Deleting a maintenance record, only after confirming. Once it's gone, focus moves to the log's
// heading, since the button that was pressed has gone with it.
import { useRef, useState, type RefObject } from 'react'
import { formatDate } from '@/core/dates'
import { MAINTENANCE_TYPE_LABELS, type MaintenanceRecord } from '@/core/maintenance'
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
import { saveProblem } from '@/ui/gear/save-problem'
import { useServices } from '@/ui/services'

interface DeleteMaintenanceButtonProps {
  readonly record: MaintenanceRecord
  /** Where focus goes once the record is deleted */
  readonly afterDelete: RefObject<HTMLElement | null>
}

export function DeleteMaintenanceButton({ record, afterDelete }: DeleteMaintenanceButtonProps) {
  const { repositories } = useServices()
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<string>()
  const deletedRef = useRef(false)
  const label = MAINTENANCE_TYPE_LABELS[record.type]
  const what = record.type === 'other' ? 'this work' : `this ${label.toLowerCase()}`

  const remove = async () => {
    try {
      await repositories.maintenance.remove(record.id)
      deletedRef.current = true
      setOpen(false)
    } catch (error) {
      setProblem(saveProblem(error))
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setProblem(undefined)
      }}
    >
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
        {/* Says which record, since every record has a Delete button. The space sits outside the
            hidden text, or the words run together. */}
        Delete <span className="sr-only">{`${label}, ${formatDate(record.date)}`}</span>
      </AlertDialogTrigger>
      <AlertDialogContent finalFocus={() => (deletedRef.current ? afterDelete.current : true)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {what}?</AlertDialogTitle>
          <AlertDialogDescription>
            It goes from the maintenance log for good.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {problem !== undefined && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {problem}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              void remove()
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
