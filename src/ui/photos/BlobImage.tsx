// An image of a stored photo. A Blob needs an object URL to show, which holds the image in memory
// until it's revoked, so the URL is made when the image appears and revoked when it goes. A ref
// callback does both, so nothing is set in an effect and StrictMode's extra mount still works.
import { useCallback, type ComponentProps } from 'react'

interface BlobImageProps extends Omit<ComponentProps<'img'>, 'src' | 'ref'> {
  readonly blob: Blob
  /** Said by screen readers, or empty when the words beside the image already say what it is */
  readonly alt: string
}

export function BlobImage({ blob, alt, ...props }: BlobImageProps) {
  const show = useCallback(
    (image: HTMLImageElement | null) => {
      if (image === null) return
      const url = URL.createObjectURL(blob)
      image.src = url
      return () => {
        URL.revokeObjectURL(url)
      }
    },
    [blob],
  )
  return <img ref={show} alt={alt} decoding="async" {...props} />
}
