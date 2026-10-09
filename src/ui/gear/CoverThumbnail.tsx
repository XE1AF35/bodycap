// An item's cover photo, small, beside its name in the gear list. The name says what it is, so
// screen readers skip the image.
import type { Photo } from '@/core/photos'
import { BlobImage } from '@/ui/photos/BlobImage'

export function CoverThumbnail({ photo }: { readonly photo: Photo | undefined }) {
  if (photo === undefined) return null
  return (
    <BlobImage
      blob={photo.thumbnail}
      alt=""
      className="size-10 shrink-0 rounded-md border border-border bg-muted object-cover"
    />
  )
}
