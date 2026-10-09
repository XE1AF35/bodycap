// Reading a chosen backup file: .json and .zip backups told apart by their content, the size caps,
// unreadable files, a .json that lists photos only its .zip holds, and what the checks say.
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import { createBackup, MAX_BACKUP_BYTES } from '@/core/backup/format'
import { MAX_ZIP_BACKUP_BYTES } from '@/core/backup/zip'
import type { Gear } from '@/core/gear'
import type { PhotoInfo } from '@/core/photos'
import { readBackupFile, type BackupFileSource } from '@/data/backup-file'

const INFO = { schemaVersion: 3, appVersion: '0.3.0', exportedAt: '2026-10-09T03:00:00.000Z' }
const NO_DATA = { gear: [], kits: [], loans: [], maintenance: [], photos: [], settings: {} }

const backup = createBackup(NO_DATA, INFO)

const body: Gear = {
  id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d',
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T5',
  status: 'owned',
}

const IMAGE = 'a JPEG image'
const THUMBNAIL = 'its thumbnail'

const photo: PhotoInfo = {
  id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
  gearId: body.id,
  isCover: true,
  mimeType: 'image/jpeg',
  width: 1600,
  height: 1200,
  bytes: IMAGE.length,
  thumbnailBytes: THUMBNAIL.length,
}

const withPhoto = createBackup({ ...NO_DATA, gear: [body], photos: [photo] }, INFO)

/** A .zip backup of `withPhoto`, as Bodycap writes it */
const zipFile = () =>
  new Blob([
    zipSync({
      'data.json': strToU8(JSON.stringify(withPhoto)),
      [`photos/${photo.id}.jpg`]: strToU8(IMAGE),
      [`thumbnails/${photo.id}.jpg`]: strToU8(THUMBNAIL),
    }).slice(),
  ])

const gone = () => Promise.reject(new DOMException('Gone', 'NotReadableError'))

/** Bytes that can't be read, as when a file is moved after it's chosen */
class Unreadable extends Blob {
  override text(): Promise<string> {
    return gone()
  }

  override arrayBuffer(): Promise<ArrayBuffer> {
    return gone()
  }
}

/** A file that can't be read past its first bytes */
const vanishing = (size: number, start: string): BackupFileSource => ({
  size,
  slice: () => new Blob([start]),
  text: gone,
  arrayBuffer: gone,
})

const UNREADABLE = { ok: false, error: "This file couldn't be read. Try choosing it again." }
const TOO_BIG = { ok: false, error: 'This file is too big to be a Bodycap backup.' }

describe('readBackupFile', () => {
  it('reads a .json backup, which has no photos to store', async () => {
    const file = new Blob([JSON.stringify(backup)], { type: 'application/json' })
    expect(await readBackupFile(file)).toEqual({
      ok: true,
      value: { ...backup, storedPhotos: [] },
    })
  })

  it('reads a .zip backup, with each photo ready to store', async () => {
    const result = await readBackupFile(zipFile())
    expect(result).toEqual({
      ok: true,
      value: {
        ...withPhoto,
        storedPhotos: [
          {
            ...photo,
            image: expect.any(ArrayBuffer) as unknown,
            thumbnail: expect.any(ArrayBuffer) as unknown,
          },
        ],
      },
    })
    const [stored] = result.ok ? result.value.storedPhotos : []
    const text = (bytes: ArrayBuffer | undefined) => new TextDecoder().decode(bytes)
    expect([text(stored?.image), text(stored?.thumbnail)]).toEqual([IMAGE, THUMBNAIL])
  })

  it('tells a .zip by its content, whatever it is called', async () => {
    const renamed = new File([zipFile()], 'backup.json', { type: 'application/json' })
    expect(await readBackupFile(renamed)).toMatchObject({ ok: true })
  })

  it('passes on what is wrong with a .zip', async () => {
    const bytes = zipSync({ 'data.json': strToU8('{}'), 'notes.txt': strToU8('hi') })
    expect(await readBackupFile(new Blob([bytes.slice()]))).toEqual({
      ok: false,
      error: "This backup holds a file Bodycap didn't put there, so it can't be restored.",
    })
  })

  it('refuses a .json that lists photos, which only the .zip it came from holds', async () => {
    expect(await readBackupFile(new Blob([JSON.stringify(withPhoto)]))).toEqual({
      ok: false,
      error:
        "This backup's photos are in the .zip file it came from. Choose that file to restore it.",
    })
  })

  it('refuses a .json over 50 MB without reading it', async () => {
    const text = vi.fn(() => Promise.resolve('{}'))
    const file = { ...vanishing(MAX_BACKUP_BYTES + 1, '{'), text }
    expect(await readBackupFile(file)).toEqual(TOO_BIG)
    expect(text).not.toHaveBeenCalled()
  })

  it('refuses any file over 4 GB without reading it', async () => {
    const slice = vi.fn(() => new Blob(['PK']))
    expect(await readBackupFile({ ...vanishing(MAX_ZIP_BACKUP_BYTES + 1, 'PK'), slice })).toEqual(
      TOO_BIG,
    )
    expect(slice).not.toHaveBeenCalled()
  })

  it.each([
    ['its first bytes', { ...vanishing(10, ''), slice: () => new Unreadable() }],
    ['a .json', vanishing(10, '{')],
    ['a .zip', vanishing(10, 'PK\u0003\u0004')],
  ])('explains when %s cannot be read', async (_name, file) => {
    expect(await readBackupFile(file)).toEqual(UNREADABLE)
  })

  it('passes on what is wrong with a file that is not a backup', async () => {
    expect(await readBackupFile(new Blob(['Shopping list']))).toEqual({
      ok: false,
      error: "This file isn't a Bodycap backup.",
    })
  })
})
