// The maintenance repository on fake-indexeddb: records belong to an item that exists, and each
// change counts towards the backup reminder.
import { afterEach, describe, expect, it } from 'vitest'
import { GearNotFoundError, RecordNotFoundError } from '@/data/repositories'
import { body, closeDatabases, current, lens, NOW, openRepositories } from './support'

afterEach(closeDatabases)

const LATER = '2026-10-07T04:00:00.000Z'
const clean = { type: 'sensor-clean', date: '2026-10-01', provider: 'Camera Clinic' } as const

describe('maintenance repository', () => {
  it('adds a record for an item, with an ID and timestamps, counting the change', async () => {
    const { repos } = openRepositories()
    const item = await repos.gear.add(body)
    const record = await repos.maintenance.add(item.id, clean)
    expect(record).toEqual({
      ...clean,
      id: '00000000-0000-4000-8000-000000000002',
      gearId: item.id,
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(await current(repos.maintenance.forGear(item.id))).toEqual([record])
    expect((await current(repos.settings.get())).changesSinceBackup).toBe(2)
  })

  it('refuses a record for an item that is no longer there', async () => {
    const { repos } = openRepositories()
    await expect(repos.maintenance.add('gone', clean)).rejects.toThrow(GearNotFoundError)
    expect((await current(repos.settings.get())).changesSinceBackup).toBe(0)
  })

  it('replaces every detail on update, keeping the item and when it was added', async () => {
    const { repos, clock } = openRepositories()
    const item = await repos.gear.add(body)
    const record = await repos.maintenance.add(item.id, clean)
    clock.now = LATER
    const firmware = {
      type: 'firmware-update',
      date: '2026-10-02',
      firmwareVersion: '3.01',
    } as const
    expect(await repos.maintenance.update(record.id, firmware)).toEqual({
      ...firmware,
      id: record.id,
      gearId: item.id,
      createdAt: NOW,
      updatedAt: LATER,
    })
    await expect(repos.maintenance.update('gone', firmware)).rejects.toThrow(RecordNotFoundError)
  })

  it("lists only an item's own records", async () => {
    const { repos } = openRepositories()
    const camera = await repos.gear.add(body)
    const zoom = await repos.gear.add(lens)
    const record = await repos.maintenance.add(camera.id, clean)
    await repos.maintenance.add(zoom.id, { type: 'repair', date: '2026-09-01' })
    expect(await current(repos.maintenance.forGear(camera.id))).toEqual([record])
  })

  it("lists every item's records together", async () => {
    const { repos } = openRepositories()
    const camera = await repos.gear.add(body)
    const zoom = await repos.gear.add(lens)
    const sensorClean = await repos.maintenance.add(camera.id, clean)
    const repair = await repos.maintenance.add(zoom.id, { type: 'repair', date: '2026-09-01' })
    expect(await current(repos.maintenance.list())).toEqual(
      expect.arrayContaining([sensorClean, repair]),
    )
    expect(await current(repos.maintenance.list())).toHaveLength(2)
  })

  it('removes a record, and does nothing for one already gone', async () => {
    const { repos } = openRepositories()
    const item = await repos.gear.add(body)
    const record = await repos.maintenance.add(item.id, clean)
    await repos.maintenance.remove(record.id)
    await repos.maintenance.remove(record.id)
    expect(await current(repos.maintenance.forGear(item.id))).toEqual([])
    expect((await current(repos.settings.get())).changesSinceBackup).toBe(3)
  })
})
