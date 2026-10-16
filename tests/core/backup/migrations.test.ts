// Backup format migrations: upgrading an older file one version at a time, and each real step.
import { describe, expect, it } from 'vitest'
import { FORMAT_VERSION } from '@/core/backup/format'
import { BACKUP_MIGRATIONS, migrateBackup, type BackupMigration } from '@/core/backup/migrations'

describe('migrateBackup', () => {
  it('leaves a backup in the current format as it is', () => {
    const file = { app: 'bodycap', formatVersion: FORMAT_VERSION, data: {} }
    expect(migrateBackup(file, FORMAT_VERSION)).toEqual(file)
  })

  describe('with made-up steps up to format 4', () => {
    const ran: number[] = []
    const step =
      (from: number): BackupMigration =>
      (file) => {
        ran.push(from)
        return { ...file, [`from${String(from)}`]: true }
      }
    const steps = { 1: step(1), 2: step(2), 3: step(3) }

    it('runs each step in order from the version the file says, updating its version', () => {
      ran.length = 0
      expect(migrateBackup({ formatVersion: 2 }, 2, 4, steps)).toEqual({
        formatVersion: 4,
        from2: true,
        from3: true,
      })
      expect(ran).toEqual([2, 3])
    })

    it('throws when a step is missing, since that is a bug in the app', () => {
      expect(() => migrateBackup({ formatVersion: 1 }, 1, 5, steps)).toThrow(
        'No backup migration from format 4',
      )
    })
  })
})

describe('format 1 to 2', () => {
  const formatOne = {
    app: 'bodycap',
    formatVersion: 1,
    schemaVersion: 1,
    appVersion: '0.1.0',
    exportedAt: '2026-10-05T03:00:00.000Z',
    counts: { gear: 1 },
    data: { gear: [{ id: 'kept as it is' }], settings: { lastUsedCurrency: 'AUD' } },
  }

  it('adds kits, loans, and maintenance, each empty and counted as none', () => {
    expect(migrateBackup(formatOne, 1, 2)).toEqual({
      ...formatOne,
      formatVersion: 2,
      counts: { gear: 1, kits: 0, loans: 0, maintenance: 0 },
      data: { ...formatOne.data, kits: [], loans: [], maintenance: [] },
    })
  })

  it.each([
    ['no data', { ...formatOne, data: undefined }],
    ['data that is a list', { ...formatOne, data: [] }],
    ['counts that are text', { ...formatOne, counts: 'one' }],
  ])('leaves a file with %s for the checks to refuse', (_name, file) => {
    expect(BACKUP_MIGRATIONS[1]?.(file)).toEqual(file)
  })
})

describe('format 2 to 3', () => {
  const formatTwo = {
    app: 'bodycap',
    formatVersion: 2,
    schemaVersion: 2,
    appVersion: '0.2.0',
    exportedAt: '2026-10-08T03:00:00.000Z',
    counts: { gear: 1, kits: 0, loans: 0, maintenance: 0 },
    data: { gear: [{ id: 'kept as it is' }], kits: [], loans: [], maintenance: [], settings: {} },
  }

  it('adds photos, empty and counted as none', () => {
    expect(migrateBackup(formatTwo, 2, 3)).toEqual({
      ...formatTwo,
      formatVersion: 3,
      counts: { ...formatTwo.counts, photos: 0 },
      data: { ...formatTwo.data, photos: [] },
    })
  })

  it.each([
    ['no data', { ...formatTwo, data: undefined }],
    ['counts that are a list', { ...formatTwo, counts: [] }],
  ])('leaves a file with %s for the checks to refuse', (_name, file) => {
    expect(BACKUP_MIGRATIONS[2]?.(file)).toEqual(file)
  })
})

describe('format 3 to 4', () => {
  // Format 4 adds weight, filter thread, and catalogue ID, all optional, so a format 3 item is
  // already a valid format 4 item. The step exists so older apps refuse format 4 files.
  it('changes nothing but the version', () => {
    const formatThree = {
      app: 'bodycap',
      formatVersion: 3,
      schemaVersion: 3,
      appVersion: '0.3.0',
      exportedAt: '2026-10-12T03:00:00.000Z',
      counts: { gear: 1, kits: 0, loans: 0, maintenance: 0, photos: 0 },
      data: { gear: [{ id: 'kept as it is' }], kits: [], loans: [], maintenance: [], photos: [] },
    }
    expect(migrateBackup(formatThree, 3, 4)).toEqual({ ...formatThree, formatVersion: 4 })
  })
})
