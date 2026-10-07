// Deleting a kit, only after confirming. Its gear stays: only the grouping goes.
import { useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Kit } from '@/core/kits'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/ui/components/ui/alert-dialog'
import { Button } from '@/ui/components/ui/button'
import { saveProblem } from '@/ui/gear/save-problem'
import { useServices } from '@/ui/services'

export function DeleteKitButton({ kit }: { readonly kit: Kit }) {
  const { repositories } = useServices()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<string>()

  const confirm = async () => {
    try {
      await repositories.kits.remove(kit.id)
      setOpen(false)
      await navigate({ to: '/kits' })
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
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <Trash2 aria-hidden="true" />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete {kit.name}?</AlertDialogTitle>
          <AlertDialogDescription>The kit goes, but none of its gear does.</AlertDialogDescription>
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
              void confirm()
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
