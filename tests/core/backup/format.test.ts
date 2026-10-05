// Making backups: the file's envelope, its counts, and its name.
import { describe, expect, it } from 'vitest'
import { backupFileName, createBackup, FORMAT_VERSION } from '@/core/backup/format'
import type { Gear } from '@/core/gear'

const tripod: Gear = {
  id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  category: 'tripod',
  brand: 'Peak Design',
  model: 'Travel Tripod',
  status: 'owned',
}

describe('createBackup', () => {
  it('wraps the data with what a restore needs to check it', () => {
    expect(
      createBackup(
        { gear: [tripod], settings: { lastUsedCurrency: 'NZD' } },
        { schemaVersion: 1, appVersion: '0.1.0', exportedAt: '2026-10-05T03:00:00.000Z' },
      ),
    ).toEqual({
      app: 'bodycap',
      formatVersion: FORMAT_VERSION,
      schemaVersion: 1,
      appVersion: '0.1.0',
      exportedAt: '2026-10-05T03:00:00.000Z',
      counts: { gear: 1 },
      data: { gear: [tripod], settings: { lastUsedCurrency: 'NZD' } },
    })
  })
})

describe('backupFileName', () => {
  it('names the file after the day it was made', () => {
    expect(backupFileName('2026-10-05')).toBe('bodycap-backup-2026-10-05.json')
  })
})
