// The .zip backup's layout: data.json, then each photo and thumbnail named by the photo's ID, each
// with the exact size it must have.
import { describe, expect, it } from 'vitest'
import { photoEntries, photoEntryNames, ZIP_DATA_NAME } from '@/core/backup/zip'
import type { PhotoInfo, PhotoType } from '@/core/photos'

const ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e'

const photo = (fields: Partial<PhotoInfo> = {}): PhotoInfo => ({
  id: ID,
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
  gearId: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d',
  isCover: true,
  mimeType: 'image/webp',
  width: 1600,
  height: 1200,
  bytes: 250_000,
  thumbnailBytes: 12_000,
  ...fields,
})

describe('ZIP_DATA_NAME', () => {
  it('is the same data a .json backup holds, under a plain name', () => {
    expect(ZIP_DATA_NAME).toBe('data.json')
  })
})

describe('photoEntryNames', () => {
  it.each<[PhotoType, string, string]>([
    ['image/webp', `photos/${ID}.webp`, `thumbnails/${ID}.webp`],
    ['image/jpeg', `photos/${ID}.jpg`, `thumbnails/${ID}.jpg`],
  ])('names a photo stored as %s by its ID', (mimeType, image, thumbnail) => {
    expect(photoEntryNames(photo({ mimeType }))).toEqual({ image, thumbnail })
  })
})

describe('photoEntries', () => {
  it('has nothing besides the data when there are no photos', () => {
    expect(photoEntries([])).toEqual(new Map())
  })

  it('lists each photo and thumbnail by name, with its exact size', () => {
    const other = photo({
      id: '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f',
      isCover: false,
      mimeType: 'image/jpeg',
      bytes: 310_000,
      thumbnailBytes: 15_000,
    })
    expect(photoEntries([photo(), other])).toEqual(
      new Map([
        [`photos/${ID}.webp`, { photoId: ID, part: 'image', bytes: 250_000 }],
        [`thumbnails/${ID}.webp`, { photoId: ID, part: 'thumbnail', bytes: 12_000 }],
        [`photos/${other.id}.jpg`, { photoId: other.id, part: 'image', bytes: 310_000 }],
        [`thumbnails/${other.id}.jpg`, { photoId: other.id, part: 'thumbnail', bytes: 15_000 }],
      ]),
    )
  })
})
