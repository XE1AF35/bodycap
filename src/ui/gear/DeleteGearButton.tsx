// Deleting an item, only after the person confirms in a dialog. The dialog keeps focus inside it,
// closes on Escape, and gives focus back to the button.
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { Gear } from '@/core/gear'
import { isStorageFull } from '@/data/storage'
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
import { gearName } from '@/ui/gear/labels'
import { useServices } from '@/ui/services'

export function DeleteGearButton({ item }: { readonly item: Gear }) {
  const { repositories } = useServices()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<string>()

  const confirm = async () => {
    try {
      await repositories.gear.remove(item.id)
      setOpen(false)
      await navigate({ to: '/gear' })
    } catch (error) {
      setProblem(
        isStorageFull(error)
          ? 'The browser has run out of space, so nothing could be changed.'
          : "It couldn't be deleted. Try again.",
      )
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
      <AlertDialogTrigger render={<Button variant="destructive" />}>Delete</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {gearName(item)}?</AlertDialogTitle>
          <AlertDialogDescription>
            It goes from Bodycap for good. Only a backup made before now could bring it back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {problem !== undefined && (
          <p role="alert" className="text-sm text-destructive">
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
