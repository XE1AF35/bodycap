// Photos of gear. Each is shrunk in the browser before it's stored, which keeps storage and backups
// small and leaves the camera's metadata behind, location included. An item with photos always has
// exactly one cover, the photo that stands for it in lists.
import { formatBytes } from './bytes'

/** The most photos one item can have */
export const MAX_PHOTOS_PER_ITEM = 12

/** The longest side of a stored photo, in pixels: sharp on a large screen, and a few hundred kB */
export const PHOTO_EDGE = 1600

/** The longest side of a thumbnail, in pixels: sharp in a list on a high-density screen */
export const THUMBNAIL_EDGE = 320

/** Bigger files are turned down before they're opened, since decoding one takes far more memory */
export const MAX_PHOTO_FILE_BYTES = 50_000_000

/**
 * The types photos are stored as, in the order to try them. WebP is smaller, but not every browser
 * can write it (Safari hands back a PNG when asked), so JPEG is the fallback.
 */
export const PHOTO_TYPES = ['image/webp', 'image/jpeg'] as const

export type PhotoType = (typeof PHOTO_TYPES)[number]

/**
 * No photo or thumbnail shrunk to its edge comes near these sizes, so anything bigger in a backup
 * has been tampered with. They also bound what a .zip backup can make the app read.
 */
export const MAX_STORED_PHOTO_BYTES = 10_000_000
export const MAX_THUMBNAIL_BYTES = 1_000_000

export interface PixelSize {
  readonly width: number
  readonly height: number
}

/** A photo's details, apart from the image and thumbnail themselves */
export interface PhotoFields {
  readonly gearId: string
  /** Whether it's the photo that stands for its item in lists */
  readonly isCover: boolean
  /** What the image and its thumbnail are stored as */
  readonly mimeType: PhotoType
  /** The image's size in pixels, within PHOTO_EDGE. Its thumbnail is the same shape. */
  readonly width: number
  readonly height: number
  /** The image's and thumbnail's sizes in bytes, so a restore can tell each arrived whole */
  readonly bytes: number
  readonly thumbnailBytes: number
}

export interface PhotoInfo extends PhotoFields {
  readonly id: string
  /** ISO 8601 UTC timestamps */
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * The size an image shrinks to so its longest side is at most `edge`, keeping its shape. A smaller
 * image keeps its size, since enlarging only adds bytes. Sides are whole pixels, and at least 1.
 */
export function fitWithin({ width, height }: PixelSize, edge: number): PixelSize {
  if (![width, height, edge].every((side) => Number.isInteger(side) && side > 0)) {
    throw new RangeError(`Can't fit ${String(width)}x${String(height)} within ${String(edge)} px`)
  }
  const scale = Math.min(1, edge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** The sizes a photo is stored at: the photo itself, and its thumbnail */
export function photoSizes(original: PixelSize): {
  readonly photo: PixelSize
  readonly thumbnail: PixelSize
} {
  return {
    photo: fitWithin(original, PHOTO_EDGE),
    thumbnail: fitWithin(original, THUMBNAIL_EDGE),
  }
}

/** What a chosen file says about itself, before it's opened */
export interface PhotoFile {
  readonly name: string
  /** The media type, which is blank when the system doesn't know it */
  readonly type: string
  /** In bytes */
  readonly size: number
}

/**
 * Why a chosen file can't be a photo, or undefined if it's worth opening. A blank type gets
 * through, since Windows gives HEIC photos from iPhones none, and opening the file decides.
 */
export function photoFileProblem({ name, type, size }: PhotoFile): string | undefined {
  const image = type === '' || (type.startsWith('image/') && type !== 'image/svg+xml')
  if (!image) return `${name} isn't a photo.`
  if (size === 0) return `${name} is empty.`
  if (size > MAX_PHOTO_FILE_BYTES) {
    return `${name} is too big. Photos can be up to ${formatBytes(MAX_PHOTO_FILE_BYTES)}.`
  }
  return undefined
}

/** Why `adding` more photos won't fit on an item that has `existing`, or undefined if they will */
export function photoCountProblem(existing: number, adding: number): string | undefined {
  const room = Math.max(0, MAX_PHOTOS_PER_ITEM - existing)
  if (adding <= room) return undefined
  if (room === 0) {
    return `This item has the most photos it can have (${String(MAX_PHOTOS_PER_ITEM)}). Delete one to add another.`
  }
  if (room === 1) return 'This item has room for 1 more photo. Choose just one.'
  return `This item has room for ${String(room)} more photos. Choose ${String(room)} or fewer.`
}

/** What the cover rules need to know about a photo */
export interface CoverPhoto {
  readonly id: string
  readonly gearId: string
  readonly isCover: boolean
  /** ISO 8601 UTC */
  readonly createdAt: string
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Oldest first. Photos added at the same moment go by ID, so the order never changes. */
export function sortPhotos<T extends Pick<CoverPhoto, 'id' | 'createdAt'>>(
  photos: readonly T[],
): T[] {
  return [...photos].sort((a, b) => compare(a.createdAt, b.createdAt) || compare(a.id, b.id))
}

/**
 * The photos whose cover flag must change so each item has exactly one cover: the photo `chosen`
 * for its item, otherwise the cover it has, otherwise its oldest photo. Two covers, which a merge
 * can bring together, come down to the oldest. Each comes back changed, ready to save.
 */
export function coverChanges<T extends CoverPhoto>(photos: readonly T[], chosen?: string): T[] {
  const items = new Map<string, T[]>()
  for (const photo of sortPhotos(photos)) {
    const itemPhotos = items.get(photo.gearId)
    if (itemPhotos === undefined) items.set(photo.gearId, [photo])
    else itemPhotos.push(photo)
  }
  return [...items.values()].flatMap((itemPhotos) => {
    const cover =
      itemPhotos.find(({ id }) => id === chosen) ??
      itemPhotos.find(({ isCover }) => isCover) ??
      itemPhotos[0]
    return itemPhotos
      .filter((photo) => photo.isCover !== (photo === cover))
      .map((photo) => ({ ...photo, isCover: photo === cover }))
  })
}
