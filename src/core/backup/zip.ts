// The .zip backup: data.json, the same text a .json backup holds, plus each photo and its thumbnail,
// named by the photo's ID. Nothing in the file chooses where anything goes, and every entry has a
// known, exact size, so a restore turns down a damaged or tampered file as it reads it.
import type { PhotoInfo, PhotoType } from '../photos'

export const ZIP_DATA_NAME = 'data.json'

/**
 * Larger files are refused before they're read. Zip files stop at 4 GiB without extensions the app
 * doesn't write, and no browser's storage holds that many photos.
 */
export const MAX_ZIP_BACKUP_BYTES = 4_000_000_000

const EXTENSIONS: Record<PhotoType, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' }

/** One photo file in a .zip backup */
export interface PhotoEntry {
  readonly photoId: string
  readonly part: 'image' | 'thumbnail'
  /** Exactly how big it must be */
  readonly bytes: number
}

/** Where a photo and its thumbnail go in a .zip backup */
export function photoEntryNames({ id, mimeType }: Pick<PhotoInfo, 'id' | 'mimeType'>): {
  readonly image: string
  readonly thumbnail: string
} {
  const extension = EXTENSIONS[mimeType]
  return { image: `photos/${id}.${extension}`, thumbnail: `thumbnails/${id}.${extension}` }
}

/** Every file a .zip backup of these photos holds besides data.json, by name */
export function photoEntries(photos: readonly PhotoInfo[]): Map<string, PhotoEntry> {
  return new Map(
    photos.flatMap((photo): [string, PhotoEntry][] => {
      const names = photoEntryNames(photo)
      return [
        [names.image, { photoId: photo.id, part: 'image', bytes: photo.bytes }],
        [names.thumbnail, { photoId: photo.id, part: 'thumbnail', bytes: photo.thumbnailBytes }],
      ]
    }),
  )
}
