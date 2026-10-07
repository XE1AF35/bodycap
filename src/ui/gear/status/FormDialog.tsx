// A change that needs details, such as who's borrowing an item, as a form in a dialog. It's open
// for as long as it's rendered: the page shows it, and takes it away on Cancel or after saving. It
// stays open until the details are saved, and says what went wrong if they can't be.
import { useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { saveProblem } from '@/ui/gear/save-problem'

interface FormDialogProps {
  readonly title: string
  readonly description?: ReactNode
  /** The button that saves */
  readonly submit: string
  /** Checks and saves, or leaves the fields saying what to fix. The page closes it once saved. */
  readonly onSubmit: () => Promise<void>
  /** Cancel, Escape, or a click outside */
  readonly onCancel: () => void
  /**
   * False when the page moves focus itself once the dialog has gone, since the button that opened
   * it may have gone too. Otherwise focus goes back to that button.
   */
  readonly returnFocus?: boolean
  /** False while what the dialog needs is still loading */
  readonly ready?: boolean
  readonly children?: ReactNode
}

export function FormDialog({
  title,
  description,
  submit,
  onSubmit,
  onCancel,
  returnFocus = true,
  ready = true,
  children,
}: FormDialogProps) {
  const [problem, setProblem] = useState<string>()
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    setProblem(undefined)
    try {
      await onSubmit()
    } catch (error) {
      setProblem(saveProblem(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent finalFocus={returnFocus}>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description !== undefined && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          {problem !== undefined && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {problem}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={busy || !ready}>
              {submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
