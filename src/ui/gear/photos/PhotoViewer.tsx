// One photo as a thumbnail that opens it full size in a dialog, with what can be done to it there:
// making it the cover, or deleting it once the person confirms. Keeping these in the dialog leaves
// one stop per photo in the gallery for keyboards, and room for the photos on a phone.
import { Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Gear } from '@/core/gear'
import type { Photo } from '@/core/photos'
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/components/ui/dialog'
import { gearName } from '@/ui/gear/labels'
import { saveProblem } from '@/ui/gear/save-problem'
import { useLive } from '@/ui/hooks/useLive'
import { BlobImage } from '@/ui/photos/BlobImage'
import { useServices } from '@/ui/services'

/** The red dot and the word, marking the cover */
export function CoverMark() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-signal" />
      Cover
    </span>
  )
}

/**
 * The photo full size, read only while the viewer is open. Until it arrives, the thumbnail stands
 * in, scaled up, so the dialog has its shape from the start.
 */
function FullImage({ photo, alt }: { readonly photo: Photo; readonly alt: string }) {
  const { repositories } = useServices()
  const image = useLive(
    useMemo(() => repositories.photos.image(photo.id), [repositories, photo.id]),
  )
  if (image.status === 'error') {
    return <p role="alert">This photo couldn't be loaded. Reload the page to try again.</p>
  }
  const full = image.status === 'ready' ? image.value : undefined
  return (
    <BlobImage
      blob={full ?? photo.thumbnail}
      alt={alt}
      width={photo.width}
      height={photo.height}
      className="max-h-[70dvh] w-full rounded-md bg-muted object-contain"
    />
  )
}

function DeletePhotoButton({ onDelete }: { readonly onDelete: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <Trash2 aria-hidden="true" />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
          <AlertDialogDescription>It goes from Bodycap for good.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface PhotoViewerProps {
  readonly item: Gear
  readonly photo: Photo
  /** Where it comes in the gallery, counting from 1 */
  readonly number: number
  readonly total: number
  /** Deletes the photo. The gallery moves focus, since this thumbnail goes with it. */
  readonly onDelete: () => Promise<void>
}

export function PhotoViewer({ item, photo, number, total, onDelete }: PhotoViewerProps) {
  const { repositories } = useServices()
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<string>()
  const position = `photo ${String(number)} of ${String(total)}`

  const change = async (save: () => Promise<void>) => {
    setProblem(undefined)
    try {
      await save()
    } catch (error) {
      setProblem(saveProblem(error))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setProblem(undefined)
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`View ${position}`}
            className="block aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted"
          />
        }
      >
        <BlobImage blob={photo.thumbnail} alt="" className="size-full object-cover" />
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{`Photo ${String(number)} of ${String(total)}`}</DialogTitle>
        </DialogHeader>
        <FullImage photo={photo} alt={`${gearName(item)}, ${position}`} />
        {photo.isCover && (
          <p className="text-sm text-muted-foreground">This is the item's cover photo.</p>
        )}
        {problem !== undefined && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {problem}
          </p>
        )}
        <DialogFooter>
          {!photo.isCover && (
            <Button
              variant="outline"
              onClick={() => {
                void change(() => repositories.photos.setCover(photo.id))
              }}
            >
              Make cover
            </Button>
          )}
          <DeletePhotoButton
            onDelete={() => {
              void change(async () => {
                await onDelete()
                setOpen(false)
              })
            }}
          />
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
