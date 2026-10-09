// Merging a backup into the database on fake-indexeddb: newer copies win either way, what's only
// here stays, every change is counted for the backup reminder, and a failed merge changes nothing.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBackup, type Backup } from '@/core/backup/format'
import type { Gear } from '@/core/gear'
import type { Loan } from '@/core/loans'
import type { MaintenanceRecord } from '@/core/maintenance'
import { RuleError } from '@/data/repositories'
import { body, closeDatabases, current, lens, NOW, openRepositories } from './support'

afterEach(closeDatabases)

const LATER = '2026-10-07T05:00:00.000Z'
const EXPORTED_AT = '2026-10-07T06:00:00.000Z'

/** A database holding a lens and a body, with a sensor clean on the body, backed up */
async function here() {
  const opened = openRepositories()
  const { repos } = opened
  const zoom = await repos.gear.add(lens)
  const camera = await repos.gear.add(body)
  const clean = await repos.maintenance.add(camera.id, { type: 'sensor-clean', date: '2026-10-01' })
  await repos.backup.create()
  return { ...opened, zoom, camera, clean }
}

/** A backup holding these lists, and nothing else */
const backupOf = (lists: Partial<Backup['data']>): Backup =>
  createBackup(
    { gear: [], kits: [], loans: [], maintenance: [], photos: [], settings: {}, ...lists },
    { schemaVersion: 2, appVersion: '0.2.0', exportedAt: EXPORTED_AT },
  )

const newGear: Gear = {
  ...body,
  id: '7c6b5a49-3827-4615-a504-f3e2d1c0b9a8',
  createdAt: LATER,
  updatedAt: LATER,
  model: 'A7C II',
}

describe('backup.merge', () => {
  it('adds what is new, takes newer copies, keeps older ones here, and leaves the rest', async () => {
    const { repos, db, zoom, camera, clean } = await here()
    const renamedLater = { ...zoom, nickname: 'Workhorse', updatedAt: LATER }
    const olderCamera = { ...camera, nickname: 'Old name', updatedAt: '2026-01-01T00:00:00.000Z' }
    const repair: MaintenanceRecord = {
      id: '1f2e3d4c-5b6a-4798-8a7b-6c5d4e3f2a1b',
      createdAt: LATER,
      updatedAt: LATER,
      gearId: newGear.id,
      type: 'repair',
      date: '2026-10-06',
    }

    const summary = await repos.backup.merge(
      backupOf({ gear: [renamedLater, olderCamera, newGear], maintenance: [repair] }),
    )

    expect(summary).toEqual({
      added: { gear: 1, kits: 0, loans: 0, maintenance: 1, photos: 0 },
      updated: { gear: 1, kits: 0, loans: 0, maintenance: 0, photos: 0 },
    })
    expect(await current(repos.gear.get(zoom.id))).toEqual(renamedLater)
    expect(await current(repos.gear.get(camera.id))).toEqual(camera)
    expect(await current(repos.gear.get(newGear.id))).toEqual(newGear)
    expect(await db.maintenance.toArray()).toEqual(expect.arrayContaining([clean, repair]))
    // Three records changed, and the data now matches no single backup
    expect(await current(repos.settings.get())).toMatchObject({
      changesSinceBackup: 3,
      lastBackupAt: NOW,
    })
  })

  it('keeps the serial index up to date for merged gear', async () => {
    const { repos, db } = await here()
    await repos.backup.merge(backupOf({ gear: [{ ...newGear, serialNumber: 'ab-12 34' }] }))
    expect(await db.gear.where('serialKey').equals('AB1234').count()).toBe(1)
  })

  it('remembers the backup currency only when this browser has none', async () => {
    const { repos } = await here()
    const withCurrency = {
      ...backupOf({}),
      data: { ...backupOf({}).data, settings: { lastUsedCurrency: 'AUD' } },
    }
    await repos.backup.merge(withCurrency)
    expect((await current(repos.settings.get())).lastUsedCurrency).toBe('AUD')
    await repos.settings.setLastUsedCurrency('USD')
    await repos.backup.merge(withCurrency)
    expect((await current(repos.settings.get())).lastUsedCurrency).toBe('USD')
  })

  it('counts nothing when the backup holds nothing newer', async () => {
    const { repos, zoom } = await here()
    const summary = await repos.backup.merge(backupOf({ gear: [zoom] }))
    expect(summary.updated.gear).toBe(0)
    expect((await current(repos.settings.get())).changesSinceBackup).toBe(0)
  })

  it('refuses an item out on a different loan in each copy, changing nothing', async () => {
    const { repos, db, zoom } = await here()
    await repos.loans.lend(zoom.id, { borrower: 'Aroha', dateOut: '2026-10-05' })
    const before = await db.loans.toArray()
    const theirs: Loan = {
      id: '2a3b4c5d-6e7f-4809-9a1b-2c3d4e5f6a7b',
      createdAt: LATER,
      updatedAt: LATER,
      gearId: zoom.id,
      borrower: 'Sam',
      dateOut: '2026-10-06',
    }
    await expect(
      repos.backup.merge(backupOf({ gear: [newGear], loans: [theirs] })),
    ).rejects.toThrow(RuleError)
    expect(await db.loans.toArray()).toEqual(before)
    expect(await current(repos.gear.get(newGear.id))).toBeUndefined()
  })

  it('leaves everything as it was when a write fails part way through', async () => {
    const { repos, db, zoom } = await here()
    const repair: MaintenanceRecord = {
      id: '1f2e3d4c-5b6a-4798-8a7b-6c5d4e3f2a1b',
      createdAt: LATER,
      updatedAt: LATER,
      gearId: zoom.id,
      type: 'repair',
      date: '2026-10-06',
    }
    // Maintenance is written last, so the gear before it has to be undone
    vi.spyOn(db.maintenance, 'bulkPut').mockRejectedValue(new Error('The disk is full'))
    const renamed = { ...zoom, nickname: 'Workhorse', updatedAt: LATER }
    await expect(
      repos.backup.merge(backupOf({ gear: [renamed, newGear], maintenance: [repair] })),
    ).rejects.toThrow('The disk is full')
    expect(await current(repos.gear.get(zoom.id))).toEqual(zoom)
    expect(await current(repos.gear.get(newGear.id))).toBeUndefined()
    expect((await current(repos.settings.get())).changesSinceBackup).toBe(0)
  })
})
