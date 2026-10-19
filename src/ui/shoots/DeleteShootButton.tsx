// Deleting a shoot, only after confirming. Its items stay: only the shoot goes.
import { useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Shoot } from '@/core/shoots'
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

export function DeleteShootButton({ shoot }: { readonly shoot: Shoot }) {
  const { repositories } = useServices()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<string>()

  const confirm = async () => {
    try {
      await repositories.shoots.remove(shoot.id)
      setOpen(false)
      await navigate({ to: '/shoots' })
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
          <AlertDialogTitle>Delete {shoot.name}?</AlertDialogTitle>
          <AlertDialogDescription>The shoot goes, but none of its items do.</AlertDialogDescription>
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
