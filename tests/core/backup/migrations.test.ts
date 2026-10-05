// Backup format migrations: upgrading an older file one version at a time.
import { describe, expect, it } from 'vitest'
import { FORMAT_VERSION } from '@/core/backup/format'
import { migrateBackup, type BackupMigration } from '@/core/backup/migrations'

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
