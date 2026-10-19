// Making backups: the file's envelope, the count of each list, and its name as .json or .zip.
import { describe, expect, it } from 'vitest'
import { backupFileName, createBackup, FORMAT_VERSION } from '@/core/backup/format'
import type { Gear } from '@/core/gear'
import type { PhotoInfo } from '@/core/photos'

const tripod: Gear = {
  id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  category: 'tripod',
  brand: 'Peak Design',
  model: 'Travel Tripod',
  status: 'owned',
}

const photo: PhotoInfo = {
  id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  gearId: tripod.id,
  isCover: true,
  mimeType: 'image/webp',
  width: 1600,
  height: 1200,
  bytes: 250_000,
  thumbnailBytes: 12_000,
}

describe('createBackup', () => {
  it('wraps the data with what a restore needs to check it', () => {
    expect(
      createBackup(
        {
          gear: [tripod],
          kits: [],
          loans: [],
          maintenance: [],
          photos: [],
          shoots: [],
          settings: { lastUsedCurrency: 'NZD' },
        },
        { schemaVersion: 1, appVersion: '0.1.0', exportedAt: '2026-10-05T03:00:00.000Z' },
      ),
    ).toEqual({
      app: 'bodycap',
      formatVersion: FORMAT_VERSION,
      schemaVersion: 1,
      appVersion: '0.1.0',
      exportedAt: '2026-10-05T03:00:00.000Z',
      counts: { gear: 1, kits: 0, loans: 0, maintenance: 0, photos: 0, shoots: 0 },
      data: {
        gear: [tripod],
        kits: [],
        loans: [],
        maintenance: [],
        photos: [],
        shoots: [],
        settings: { lastUsedCurrency: 'NZD' },
      },
    })
  })

  it('counts each list on its own', () => {
    const backup = createBackup(
      {
        gear: [tripod],
        kits: [
          {
            id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z',
            name: 'Landscape',
            gearIds: [tripod.id],
            checklist: false,
            packedGearIds: [],
          },
        ],
        loans: [],
        maintenance: [],
        photos: [photo],
        shoots: [
          {
            id: '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f',
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
            date: '2026-07-31',
            name: 'Tongariro crossing',
            gearIds: [tripod.id],
          },
        ],
        settings: {},
      },
      { schemaVersion: 2, appVersion: '0.2.0', exportedAt: '2026-10-05T03:00:00.000Z' },
    )
    expect(backup.counts).toEqual({
      gear: 1,
      kits: 1,
      loans: 0,
      maintenance: 0,
      photos: 1,
      shoots: 1,
    })
  })
})

describe('backupFileName', () => {
  it('names the file after the day it was made', () => {
    expect(backupFileName('2026-10-05')).toBe('bodycap-backup-2026-10-05.json')
  })

  it('names a backup with photos as a .zip', () => {
    expect(backupFileName('2026-10-05', 'zip')).toBe('bodycap-backup-2026-10-05.zip')
  })
})
