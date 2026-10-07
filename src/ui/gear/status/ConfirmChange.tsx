// A change that needs no details, such as sending an item for repair, after a confirm. Like the form
// dialogs, it's open for as long as the page renders it.
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog'
import { saveProblem } from '@/ui/gear/save-problem'

interface ConfirmChangeProps {
  readonly title: string
  readonly description: string
  readonly confirm: string
  /** Saves the change, throwing if it can't be */
  readonly onConfirm: () => Promise<void>
  readonly onCancel: () => void
}

export function ConfirmChange({
  title,
  description,
  confirm,
  onConfirm,
  onCancel,
}: ConfirmChangeProps) {
  const [problem, setProblem] = useState<string>()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } catch (error) {
      setProblem(saveProblem(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      {/* The status bar moves focus itself once this has gone */}
      <AlertDialogContent finalFocus={false}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {problem !== undefined && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {problem}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={() => {
              void run()
            }}
          >
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
