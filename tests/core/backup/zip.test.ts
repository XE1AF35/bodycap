// The .zip backup: its layout of data.json, then each photo and thumbnail named by the photo's ID
// with the exact size it must have, the most each kind of entry can unpack to, and reading one back,
// refusing every way a file can disagree with its own data.
import { strToU8, zipSync, type Zippable } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createBackup, type BackupData } from '@/core/backup/format'
import {
  maxEntryBytes,
  photoEntries,
  photoEntryNames,
  readZipBackup,
  ZIP_DATA_NAME,
} from '@/core/backup/zip'
import type { Gear } from '@/core/gear'
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

describe('maxEntryBytes', () => {
  it.each([
    ['data.json', 50 * 1024 * 1024],
    [`photos/${ID}.webp`, 10_000_000],
    [`thumbnails/${ID}.jpg`, 1_000_000],
  ])('lets %s unpack to %i bytes at most', (name, bytes) => {
    expect(maxEntryBytes(name)).toBe(bytes)
  })

  it.each(['notes.txt', 'Data.json', 'bodycap/data.json', '__MACOSX/._data.json', ''])(
    'has no room for %j, which no .zip backup holds',
    (name) => {
      expect(maxEntryBytes(name)).toBeUndefined()
    },
  )
})

describe('readZipBackup', () => {
  const body: Gear = {
    id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d',
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
    category: 'camera-body',
    brand: 'Fujifilm',
    model: 'X-T5',
    status: 'owned',
  }
  const IMAGE = strToU8('a WebP image')
  const THUMBNAIL = strToU8('its thumbnail')
  const stored = photo({ bytes: IMAGE.length, thumbnailBytes: THUMBNAIL.length })
  const OTHER = '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f'

  const backupOf = (data: Partial<BackupData>) =>
    createBackup(
      {
        gear: [],
        kits: [],
        loans: [],
        maintenance: [],
        photos: [],
        shoots: [],
        settings: {},
        ...data,
      },
      { schemaVersion: 3, appVersion: '0.3.0', exportedAt: '2026-10-09T03:00:00.000Z' },
    )
  const backup = backupOf({ gear: [body], photos: [stored] })

  /** A .zip backup's entries, as Bodycap writes them, with any replaced or added */
  const entries = (changes: Zippable = {}): Zippable => ({
    [ZIP_DATA_NAME]: strToU8(JSON.stringify(backup)),
    [`photos/${ID}.webp`]: IMAGE,
    [`thumbnails/${ID}.webp`]: THUMBNAIL,
    ...changes,
  })

  const DAMAGED = { ok: false, error: "This backup is damaged, so it can't be restored." }
  const UNEXPECTED = {
    ok: false,
    error: "This backup holds a file Bodycap didn't put there, so it can't be restored.",
  }

  it('reads the data, and each photo with its image and thumbnail', () => {
    expect(readZipBackup(zipSync(entries(), { level: 0 }))).toEqual({
      ok: true,
      value: { backup, photos: [{ ...stored, image: IMAGE, thumbnail: THUMBNAIL }] },
    })
  })

  it('reads photos that another zip tool compressed', () => {
    expect(readZipBackup(zipSync(entries(), { level: 9 }))).toMatchObject({ ok: true })
  })

  it('reads a backup with no photos', () => {
    const none = backupOf({})
    const bytes = zipSync({ [ZIP_DATA_NAME]: strToU8(JSON.stringify(none)) })
    expect(readZipBackup(bytes)).toEqual({ ok: true, value: { backup: none, photos: [] } })
  })

  it.each<[string, Zippable, unknown]>([
    ['a file Bodycap did not put there', { 'notes.txt': strToU8('hi') }, UNEXPECTED],
    ['a photo its data does not list', { [`photos/${OTHER}.webp`]: IMAGE }, UNEXPECTED],
    ['a photo cut short', { [`photos/${ID}.webp`]: IMAGE.subarray(0, 5) }, DAMAGED],
    [
      'data that is not a backup',
      { [ZIP_DATA_NAME]: strToU8('Shopping list') },
      { ok: false, error: "This file isn't a Bodycap backup." },
    ],
    [
      'data with a photo of gear it does not have',
      { [ZIP_DATA_NAME]: strToU8(JSON.stringify(backupOf({ photos: [stored] }))) },
      {
        ok: false,
        error:
          "Photo 1 in this backup is for gear that isn't in the backup, so it can't be restored.",
      },
    ],
  ])('refuses a .zip with %s', (_name, changes, refusal) => {
    expect(readZipBackup(zipSync(entries(changes)))).toEqual(refusal)
  })

  it.each<[string, Zippable]>([
    ['a thumbnail', { [`photos/${ID}.webp`]: IMAGE }],
    ['both files of a photo', {}],
  ])('refuses a .zip missing %s its data lists', (_name, photoFiles) => {
    const bytes = zipSync({ [ZIP_DATA_NAME]: strToU8(JSON.stringify(backup)), ...photoFiles })
    expect(readZipBackup(bytes)).toEqual({
      ok: false,
      error: "This backup is incomplete, so it can't be restored.",
    })
  })

  it('refuses a .zip with no data as not a backup', () => {
    const bytes = zipSync({ [`photos/${ID}.webp`]: IMAGE })
    expect(readZipBackup(bytes)).toEqual({ ok: false, error: "This file isn't a Bodycap backup." })
  })

  /**
   * A zip whose directory says these entries unpack to `size` bytes each. Only the directory is
   * read before unpacking, so this is all a hostile file needs to change.
   */
  const declaring = (bytes: Uint8Array, names: readonly string[], size: number) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    for (let at = 0; at + 46 <= bytes.length; at += 1) {
      if (view.getUint32(at, true) !== 0x02014b50) continue
      const nameLength = view.getUint16(at + 28, true)
      const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength))
      if (names.includes(name)) view.setUint32(at + 24, size, true)
    }
    return bytes
  }

  it('refuses a .zip with a photo bigger than any Bodycap stores, before unpacking it', () => {
    const name = `photos/${ID}.webp`
    expect(readZipBackup(declaring(zipSync(entries()), [name], 10_000_001))).toEqual(DAMAGED)
  })

  it('refuses a .zip whose entries would unpack to far more than the file holds', () => {
    // Each fits the limit for a photo, but together they'd unpack to 60 MB from a few bytes
    const names = Array.from({ length: 6 }, (_, index) => `photos/${String(index)}.webp`)
    const bytes = zipSync(Object.fromEntries(names.map((name) => [name, IMAGE])), { level: 0 })
    // Five would still fit, and get as far as finding there's no data
    expect(readZipBackup(declaring(bytes, names.slice(0, 5), 10_000_000))).toEqual({
      ok: false,
      error: "This file isn't a Bodycap backup.",
    })
    expect(readZipBackup(declaring(bytes, names, 10_000_000))).toEqual(DAMAGED)
  })

  it('refuses a .zip with the same name twice', () => {
    const bytes = zipSync(entries({ 'data.jsoX': strToU8('{}') }))
    // Renamed in both the entry and the zip's directory, since zipSync won't write a name twice
    const misspelt = strToU8('data.jsoX')
    for (let at = 0; at + misspelt.length <= bytes.length; at += 1) {
      if (misspelt.every((byte, offset) => bytes[at + offset] === byte)) {
        bytes[at + misspelt.length - 1] = 'n'.charCodeAt(0)
      }
    }
    expect(readZipBackup(bytes)).toEqual(DAMAGED)
  })

  it.each<[string, Uint8Array]>([
    ['a zip with its end cut off', zipSync(entries()).subarray(0, 60)],
    ['no zip at all', strToU8('PK but nothing else')],
  ])('refuses %s as damaged', (_name, bytes) => {
    expect(readZipBackup(bytes)).toEqual(DAMAGED)
  })
})
