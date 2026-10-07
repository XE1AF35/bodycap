// A status change that needs details, such as who's borrowing an item, as a form in a dialog. The
// dialog stays open until the details are saved, and says what went wrong if they can't be.
import { useState, type ReactNode, type RefObject } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { saveProblem } from '@/ui/gear/save-problem'

interface FormDialogProps {
  /** The button that opens it */
  readonly trigger: string
  readonly title: string
  readonly description?: ReactNode
  /** The button that saves */
  readonly submit: string
  readonly finalFocus: RefObject<HTMLElement | null>
  /** Starts the fields afresh each time the dialog opens */
  readonly onOpen: () => void
  /** Checks and saves: true once saved, or false to stay open with the fields saying what to fix */
  readonly onSubmit: () => Promise<boolean>
  /** False while what the dialog needs is still loading */
  readonly ready?: boolean
  readonly children?: ReactNode
}

export function FormDialog({
  trigger,
  title,
  description,
  submit,
  finalFocus,
  onOpen,
  onSubmit,
  ready = true,
  children,
}: FormDialogProps) {
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<string>()
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    setProblem(undefined)
    try {
      if (await onSubmit()) setOpen(false)
    } catch (error) {
      setProblem(saveProblem(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setProblem(undefined)
          onOpen()
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>{trigger}</DialogTrigger>
      <DialogContent finalFocus={finalFocus}>
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
