// Reading a chosen backup file: the size cap, unreadable files, and what readBackup says.
import { describe, expect, it, vi } from 'vitest'
import { createBackup, MAX_BACKUP_BYTES } from '@/core/backup/format'
import { readBackupFile } from '@/data/backup-file'

const backup = createBackup(
  { gear: [], kits: [], loans: [], maintenance: [], settings: {} },
  { schemaVersion: 1, appVersion: '0.1.0', exportedAt: '2026-10-05T03:00:00.000Z' },
)

describe('readBackupFile', () => {
  it('reads a backup file', async () => {
    const file = new Blob([JSON.stringify(backup)], { type: 'application/json' })
    expect(await readBackupFile(file)).toEqual({ ok: true, value: backup })
  })

  it('refuses a file over 50 MB without reading it', async () => {
    const text = vi.fn(() => Promise.resolve('{}'))
    expect(await readBackupFile({ size: MAX_BACKUP_BYTES + 1, text })).toEqual({
      ok: false,
      error: 'This file is too big to be a Bodycap backup.',
    })
    expect(text).not.toHaveBeenCalled()
  })

  it('explains when the file cannot be read', async () => {
    const text = () => Promise.reject(new DOMException('Gone', 'NotReadableError'))
    expect(await readBackupFile({ size: 10, text })).toEqual({
      ok: false,
      error: "This file couldn't be read. Try choosing it again.",
    })
  })

  it('passes on what is wrong with a file that is not a backup', async () => {
    expect(await readBackupFile(new Blob(['Shopping list']))).toEqual({
      ok: false,
      error: "This file isn't a Bodycap backup.",
    })
  })
})
