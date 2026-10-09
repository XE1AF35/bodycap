// Shrinking a chosen photo in the browser before it's stored. Drawing it on a canvas and encoding it
// again leaves all of the camera's metadata behind, location included, and nothing leaves the
// device.
import {
  PHOTO_TYPES,
  photoFileProblem,
  photoSizes,
  type NewPhoto,
  type PixelSize,
} from '@/core/photos'
import { err, ok, type Result } from '@/core/result'

/** Sharp at its size, at a few hundred kB for a photo */
const QUALITY = 0.82

/** A picture that can be drawn smaller and written out as a file */
export interface Picture extends PixelSize {
  /** A copy drawn at `size` */
  scaled(size: PixelSize): Picture
  /**
   * The picture as a file of `type`, or null if the browser couldn't write one. A browser that
   * can't write a type writes another instead, such as PNG.
   */
  encode(type: string, quality: number): Promise<Blob | null>
}

/** Opens a file as a picture, turned upright as the camera recorded it */
export type DecodePhoto = (file: Blob) => Promise<Picture & { close(): void }>

function canvasPicture(source: CanvasImageSource, { width, height }: PixelSize): Picture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('This browser has no 2D canvas')
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  return {
    width,
    height,
    scaled: (size) => canvasPicture(canvas, size),
    encode: (type, quality) =>
      new Promise((resolve) => {
        canvas.toBlob(resolve, type, quality)
      }),
  }
}

const decodeInBrowser: DecodePhoto = async (file) => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  return {
    ...canvasPicture(bitmap, bitmap),
    close: () => {
      bitmap.close()
    },
  }
}

/** Writes both pictures as the first type the browser can write, or null if it can write neither */
async function encodeBoth(photo: Picture, thumbnail: Picture) {
  for (const mimeType of PHOTO_TYPES) {
    const image = await photo.encode(mimeType, QUALITY)
    if (image?.type !== mimeType) continue
    const small = await thumbnail.encode(mimeType, QUALITY)
    if (small?.type === mimeType) return { image, thumbnail: small, mimeType }
  }
  return null
}

/** A chosen photo shrunk and ready to save, or a plain message about why it can't be used */
export async function compressPhoto(
  file: File,
  decode: DecodePhoto = decodeInBrowser,
): Promise<Result<NewPhoto>> {
  const problem = photoFileProblem(file)
  if (problem !== undefined) return err(problem)
  let original: Awaited<ReturnType<DecodePhoto>>
  try {
    original = await decode(file)
  } catch {
    return err(`${file.name} can't be opened in this browser. Try a JPEG or PNG copy of it.`)
  }
  try {
    const sizes = photoSizes(original)
    const photo = original.scaled(sizes.photo)
    // Drawn from the shrunk photo, which looks better than one big jump and costs less
    const encoded = await encodeBoth(photo, photo.scaled(sizes.thumbnail))
    if (encoded === null) return err(`${file.name} couldn't be shrunk to save. Try another photo.`)
    return ok({ ...encoded, ...sizes.photo })
  } finally {
    original.close()
  }
}
