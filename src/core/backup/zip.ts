// The .zip backup: data.json, the same text a .json backup holds, plus each photo and its thumbnail,
// named by the photo's ID. Nothing in the file chooses where anything goes, and every entry has a
// known, exact size, so a restore turns down a damaged or tampered file before using any of it.
import { strFromU8, unzipSync, type Unzipped } from 'fflate'
import {
  MAX_STORED_PHOTO_BYTES,
  MAX_THUMBNAIL_BYTES,
  type PhotoInfo,
  type PhotoType,
} from '../photos'
import { err, ok, type Result } from '../result'
import { MAX_BACKUP_BYTES, type Backup } from './format'
import { DAMAGED, INCOMPLETE, NOT_A_BACKUP, readBackup } from './read'

export const ZIP_DATA_NAME = 'data.json'

/**
 * Larger files are refused before they're read. Zip files stop at 4 GiB without extensions the app
 * doesn't write, and no browser's storage holds that many photos.
 */
export const MAX_ZIP_BACKUP_BYTES = 4_000_000_000

const UNEXPECTED = "This backup holds a file Bodycap didn't put there, so it can't be restored."

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

/**
 * The most an entry can unpack to, by its name, or undefined for a name no .zip backup has. Which
 * photo an entry is gets checked once data.json has been read.
 */
export function maxEntryBytes(name: string): number | undefined {
  if (name === ZIP_DATA_NAME) return MAX_BACKUP_BYTES
  if (name.startsWith('photos/')) return MAX_STORED_PHOTO_BYTES
  if (name.startsWith('thumbnails/')) return MAX_THUMBNAIL_BYTES
  return undefined
}

/** A photo from a .zip backup: its details, with its image and thumbnail as bytes */
export interface ZippedPhoto extends PhotoInfo {
  readonly image: Uint8Array
  readonly thumbnail: Uint8Array
}

/** What a .zip backup holds: the backup, and each photo it lists in the same order */
export interface ZipBackup {
  readonly backup: Backup
  readonly photos: readonly ZippedPhoto[]
}

/** Unpacks every entry, once each name and size has been checked, or says why it won't */
function unpack(bytes: Uint8Array): Result<Unzipped> {
  let problem: string | undefined
  const names = new Set<string>()
  // Photos are stored as they are, so only data.json can unpack to more than it takes up
  let room = bytes.length + MAX_BACKUP_BYTES
  try {
    const entries = unzipSync(bytes, {
      filter: ({ name, originalSize }) => {
        const limit = maxEntryBytes(name)
        room -= originalSize
        if (limit === undefined) problem ??= UNEXPECTED
        else if (originalSize > limit || room < 0 || names.has(name)) problem ??= DAMAGED
        names.add(name)
        return problem === undefined
      },
    })
    return problem === undefined ? ok(entries) : err(problem)
  } catch {
    return err(DAMAGED)
  }
}

/**
 * Reads a .zip backup's bytes. Nothing is unpacked until every entry's name and size has been
 * checked, and the photos must be exactly the ones its data lists, at exactly their sizes.
 */
export function readZipBackup(bytes: Uint8Array): Result<ZipBackup> {
  const entries = unpack(bytes)
  if (!entries.ok) return entries
  const { [ZIP_DATA_NAME]: data, ...files } = entries.value
  if (data === undefined) return err(NOT_A_BACKUP)
  const read = readBackup(strFromU8(data))
  if (!read.ok) return read

  const expected = photoEntries(read.value.data.photos)
  const parts = new Map<string, Partial<Record<PhotoEntry['part'], Uint8Array>>>()
  for (const [name, content] of Object.entries(files)) {
    const entry = expected.get(name)
    if (entry === undefined) return err(UNEXPECTED)
    if (content.length !== entry.bytes) return err(DAMAGED)
    parts.set(entry.photoId, { ...parts.get(entry.photoId), [entry.part]: content })
  }

  const photos: ZippedPhoto[] = []
  for (const photo of read.value.data.photos) {
    const { image, thumbnail } = parts.get(photo.id) ?? {}
    if (image === undefined || thumbnail === undefined) return err(INCOMPLETE)
    photos.push({ ...photo, image, thumbnail })
  }
  return ok({ backup: read.value, photos })
}
