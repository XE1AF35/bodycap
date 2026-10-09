// An item's photos on its page: thumbnails in the order they were added, the cover marked, each
// opening full size, and Add photos, which takes several at once from files or a phone's camera.
// Photos are shrunk one at a time, so only one full-size photo is open at once.
import { ImagePlus } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Gear } from '@/core/gear'
import { LOCALE } from '@/core/locale'
import { photoCountProblem, type NewPhoto, type Photo } from '@/core/photos'
import { Button } from '@/ui/components/ui/button'
import { saveProblem } from '@/ui/gear/save-problem'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { CoverMark, PhotoViewer } from './PhotoViewer'

const numbers = new Intl.NumberFormat(LOCALE)
const photoCount = (count: number) => `${numbers.format(count)} ${count === 1 ? 'photo' : 'photos'}`

// One shared empty list while the photos load
const NO_PHOTOS: readonly Photo[] = []

export function ItemPhotos({ item }: { readonly item: Gear }) {
  const { repositories, compressPhoto } = useServices()
  const photos = useLive(
    useMemo(() => repositories.photos.forGear(item.id), [repositories, item.id]),
  )
  const titleId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState('')
  const [problems, setProblems] = useState<readonly string[]>([])

  const saved = photos.status === 'ready' ? photos.value : NO_PHOTOS
  // Set before a photo is deleted, since the list can update before the delete says it's done
  const refocusRef = useRef(false)

  // A deleted photo's thumbnail goes with it, and the dialog it opened may go before it can move
  // focus, so focus moves to the heading once the photo has left the list
  useEffect(() => {
    if (!refocusRef.current) return
    refocusRef.current = false
    headingRef.current?.focus()
  }, [saved])

  const remove = async (photo: Photo) => {
    refocusRef.current = true
    try {
      await repositories.photos.remove(photo.id)
    } catch (error) {
      refocusRef.current = false
      throw error
    }
  }
  // Says so when the item is full, and how many will fit when too many are chosen
  const full = photoCountProblem(saved.length, 1)

  const add = async (files: readonly File[]) => {
    setStatus('')
    const tooMany = photoCountProblem(saved.length, files.length)
    if (tooMany !== undefined) {
      setProblems([tooMany])
      return
    }
    setAdding(true)
    setProblems([])
    setStatus(`Adding ${photoCount(files.length)}.`)
    const shrunk: NewPhoto[] = []
    const unusable: string[] = []
    for (const file of files) {
      const result = await compressPhoto(file)
      if (result.ok) shrunk.push(result.value)
      else unusable.push(result.error)
    }
    try {
      if (shrunk.length > 0) await repositories.photos.add(item.id, shrunk)
      setStatus(shrunk.length > 0 ? `Added ${photoCount(shrunk.length)}.` : '')
    } catch (error) {
      unusable.push(saveProblem(error))
      setStatus('')
    } finally {
      setAdding(false)
      setProblems(unusable)
    }
  }

  return (
    <section aria-labelledby={titleId} className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {/* Focusable from script, for after a photo is deleted */}
        <h2
          id={titleId}
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold outline-none"
        >
          Photos
        </h2>
        {photos.status === 'ready' && full === undefined && (
          <>
            <Button
              variant="outline"
              disabled={adding}
              onClick={() => {
                inputRef.current?.click()
              }}
            >
              <ImagePlus aria-hidden="true" />
              Add photos
            </Button>
            {/* The button opens this, which phones offer as the camera or the photo library */}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              aria-label="Photos to add"
              onChange={(event) => {
                const files = [...(event.currentTarget.files ?? [])]
                // Cleared, so choosing the same file again still counts as a change
                event.currentTarget.value = ''
                void add(files)
              }}
            />
          </>
        )}
      </div>
      {full !== undefined && <p className="mb-3 text-sm text-muted-foreground">{full}</p>}
      {/* Always there, so screen readers announce what's put in it */}
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
      {problems.length > 0 && (
        <p role="alert" className="mt-1 text-sm font-medium text-destructive">
          {problems.join(' ')}
        </p>
      )}
      {photos.status === 'error' && (
        <p role="alert">The photos couldn't be loaded. Reload the page to try again.</p>
      )}
      {photos.status === 'ready' && saved.length === 0 && (
        <p className="text-sm text-muted-foreground">No photos yet.</p>
      )}
      {saved.length > 0 && (
        <ul aria-label="Photos" className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {saved.map((photo, index) => (
            <li key={photo.id} className="grid content-start gap-1.5">
              <PhotoViewer
                item={item}
                photo={photo}
                number={index + 1}
                total={saved.length}
                onDelete={() => remove(photo)}
              />
              {photo.isCover && <CoverMark />}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
