// A status change that needs no details, such as sending an item for repair, after a confirm.
import { useState, type RefObject } from 'react'
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

interface ConfirmChangeProps {
  readonly trigger: string
  readonly title: string
  readonly description: string
  readonly confirm: string
  readonly finalFocus: RefObject<HTMLElement | null>
  /** Saves the change, throwing if it can't be */
  readonly onConfirm: () => Promise<void>
}

export function ConfirmChange({
  trigger,
  title,
  description,
  confirm,
  finalFocus,
  onConfirm,
}: ConfirmChangeProps) {
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<string>()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch (error) {
      setProblem(saveProblem(error))
    } finally {
      setBusy(false)
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
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent finalFocus={finalFocus}>
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
