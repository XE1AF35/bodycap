// The shoot repository on fake-indexeddb: logging, changing, and deleting shoots, refusing items
// that are gone, and counting each change for the backup reminder.
import { afterEach, describe, expect, it } from 'vitest'
import { GearNotFoundError, RecordNotFoundError } from '@/data/repositories'
import { body, closeDatabases, current, lens, NOW, openRepositories } from './support'

afterEach(closeDatabases)

const LATER = '2026-10-07T02:00:00.000Z'

async function withGear() {
  const opened = openRepositories()
  const { repos } = opened
  const items = [await repos.gear.add(lens), await repos.gear.add(body)]
  return { ...opened, ids: items.map(({ id }) => id) }
}

const changes = async (repos: ReturnType<typeof openRepositories>['repos']) =>
  (await current(repos.settings.get())).changesSinceBackup

describe('shoot repository', () => {
  it('logs a shoot with an ID and timestamps, counting the change', async () => {
    const { repos, ids } = await withGear()
    const before = await changes(repos)
    const shoot = await repos.shoots.add({
      date: '2026-10-04',
      name: 'Kaikoura whales',
      gearIds: ids,
      notes: 'Calm sea',
    })
    expect(shoot).toEqual({
      id: '00000000-0000-4000-8000-000000000003',
      createdAt: NOW,
      updatedAt: NOW,
      date: '2026-10-04',
      name: 'Kaikoura whales',
      gearIds: ids,
      notes: 'Calm sea',
    })
    expect(await current(repos.shoots.get(shoot.id))).toEqual(shoot)
    expect(await current(repos.shoots.list())).toEqual([shoot])
    expect(await changes(repos)).toBe(before + 1)
  })

  it('logs a shoot with no items', async () => {
    const { repos } = openRepositories()
    const shoot = await repos.shoots.add({ date: '2026-10-04', name: 'Scouting', gearIds: [] })
    expect(await current(repos.shoots.list())).toEqual([shoot])
  })

  it('replaces a shoot, keeping its ID and when it was logged, so cleared notes are gone', async () => {
    const { repos, clock, ids } = await withGear()
    const shoot = await repos.shoots.add({
      date: '2026-10-04',
      name: 'Kaikoura',
      gearIds: ids,
      notes: 'Calm sea',
    })
    clock.now = LATER
    const before = await changes(repos)
    const changed = await repos.shoots.update(shoot.id, {
      date: '2026-10-05',
      name: 'Kaikoura whales',
      gearIds: [ids[1] ?? ''],
    })
    expect(changed).toEqual({
      id: shoot.id,
      createdAt: NOW,
      updatedAt: LATER,
      date: '2026-10-05',
      name: 'Kaikoura whales',
      gearIds: [ids[1]],
    })
    expect(await current(repos.shoots.get(shoot.id))).toEqual(changed)
    expect(await changes(repos)).toBe(before + 1)
  })

  it('refuses a shoot with an item that is no longer there, saving nothing', async () => {
    const { repos, ids } = await withGear()
    const [gone = ''] = ids
    await repos.gear.remove(gone)
    await expect(
      repos.shoots.add({ date: '2026-10-04', name: 'Kaikoura', gearIds: ids }),
    ).rejects.toThrow(GearNotFoundError)
    expect(await current(repos.shoots.list())).toEqual([])
  })

  it('refuses a change that adds an item that is no longer there, changing nothing', async () => {
    const { repos, ids } = await withGear()
    const [gone = '', kept = ''] = ids
    const shoot = await repos.shoots.add({ date: '2026-10-04', name: 'Kaikoura', gearIds: [kept] })
    await repos.gear.remove(gone)
    await expect(repos.shoots.update(shoot.id, { ...shoot, gearIds: ids })).rejects.toThrow(
      GearNotFoundError,
    )
    expect(await current(repos.shoots.get(shoot.id))).toEqual(shoot)
  })

  it('refuses to change a shoot that is gone', async () => {
    const { repos } = openRepositories()
    await expect(
      repos.shoots.update('missing', { date: '2026-10-04', name: 'Kaikoura', gearIds: [] }),
    ).rejects.toThrow(RecordNotFoundError)
  })

  it('deletes a shoot but none of its items, counting the change', async () => {
    const { repos, ids } = await withGear()
    const shoot = await repos.shoots.add({ date: '2026-10-04', name: 'Kaikoura', gearIds: ids })
    const before = await changes(repos)
    await repos.shoots.remove(shoot.id)
    expect(await current(repos.shoots.get(shoot.id))).toBeUndefined()
    expect(await current(repos.gear.list())).toHaveLength(2)
    expect(await changes(repos)).toBe(before + 1)
  })

  it('does nothing when deleting a shoot that is already gone', async () => {
    const { repos } = openRepositories()
    await repos.shoots.remove('missing')
    expect(await changes(repos)).toBe(0)
  })

  it('keeps sold and lost items on their shoots', async () => {
    const { repos, ids } = await withGear()
    const [sold = '', lost = ''] = ids
    const shoot = await repos.shoots.add({ date: '2026-10-04', name: 'Kaikoura', gearIds: ids })
    await repos.gear.update(sold, { ...lens, status: 'sold', saleDate: '2026-10-06' })
    await repos.gear.update(lost, { ...body, status: 'lost', lostDate: '2026-10-06' })
    expect(await current(repos.shoots.get(shoot.id))).toEqual(shoot)
  })
})
