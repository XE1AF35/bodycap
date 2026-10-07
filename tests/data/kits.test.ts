// The kit repository on fake-indexeddb: adding kits, changing them with the kit rules, which kits
// an item is in, and what counts as a change for the backup reminder.
import { afterEach, describe, expect, it } from 'vitest'
import { addToKit, setChecklist, setPacked } from '@/core/kits'
import { GearNotFoundError, RecordNotFoundError } from '@/data/repositories'
import { body, closeDatabases, current, lens, NOW, openRepositories } from './support'

afterEach(closeDatabases)

const LATER = '2026-10-07T02:00:00.000Z'

async function withGear() {
  const opened = openRepositories()
  const { repos } = opened
  const items = [await repos.gear.add(lens), await repos.gear.add(body)]
  return { ...opened, items, ids: items.map(({ id }) => id) }
}

const changes = async (repos: ReturnType<typeof openRepositories>['repos']) =>
  (await current(repos.settings.get())).changesSinceBackup

describe('kit repository', () => {
  it('adds an empty kit with the checklist off, an ID, and timestamps, counting the change', async () => {
    const { repos } = openRepositories()
    const kit = await repos.kits.add({ name: 'Wedding', description: 'Two bodies' })
    expect(kit).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      createdAt: NOW,
      updatedAt: NOW,
      name: 'Wedding',
      description: 'Two bodies',
      gearIds: [],
      checklist: false,
      packedGearIds: [],
    })
    expect(await current(repos.kits.get(kit.id))).toEqual(kit)
    expect(await changes(repos)).toBe(1)
  })

  it('changes a kit with a kit rule, keeping its ID and when it was added', async () => {
    const { repos, clock, ids } = await withGear()
    const kit = await repos.kits.add({ name: 'Wedding' })
    clock.now = LATER
    const changed = await repos.kits.update(kit.id, (saved) => addToKit(saved, ids))
    expect(changed).toEqual({ ...kit, gearIds: ids, updatedAt: LATER })
    expect(await current(repos.kits.get(kit.id))).toEqual(changed)
  })

  it('applies each change to the kit as saved, so quick ticks never undo each other', async () => {
    const { repos, ids } = await withGear()
    const kit = await repos.kits.add({ name: 'Wedding' })
    await repos.kits.update(kit.id, (saved) => setChecklist(addToKit(saved, ids), true))
    await Promise.all(
      ids.map((id) => repos.kits.update(kit.id, (saved) => setPacked(saved, id, true))),
    )
    expect((await current(repos.kits.get(kit.id)))?.packedGearIds).toEqual(ids)
  })

  it('counts ticks as no change for the backup reminder, since they are undone each trip', async () => {
    const { repos, ids } = await withGear()
    const kit = await repos.kits.add({ name: 'Wedding' })
    await repos.kits.update(kit.id, (saved) => setChecklist(addToKit(saved, ids), true))
    const before = await changes(repos)
    await repos.kits.update(kit.id, (saved) => setPacked(saved, ids[0] ?? '', true))
    expect(await changes(repos)).toBe(before)
    await repos.kits.update(kit.id, (saved) => ({ ...saved, name: 'Weddings' }))
    expect(await changes(repos)).toBe(before + 1)
  })

  it('refuses to add gear that is no longer there, changing nothing', async () => {
    const { repos, ids } = await withGear()
    const kit = await repos.kits.add({ name: 'Wedding' })
    const [gone = ''] = ids
    await repos.gear.remove(gone)
    await expect(repos.kits.update(kit.id, (saved) => addToKit(saved, ids))).rejects.toThrow(
      GearNotFoundError,
    )
    expect((await current(repos.kits.get(kit.id)))?.gearIds).toEqual([])
  })

  it('refuses to change a kit that is no longer there', async () => {
    const { repos } = openRepositories()
    await expect(repos.kits.update('gone', (saved) => saved)).rejects.toThrow(RecordNotFoundError)
  })

  it('lists the kits an item is in, keeping up as kits change', async () => {
    const { repos, ids } = await withGear()
    const [lensId = '', bodyId = ''] = ids
    const wedding = await repos.kits.add({ name: 'Wedding' })
    const travel = await repos.kits.add({ name: 'Travel' })
    await repos.kits.update(wedding.id, (saved) => addToKit(saved, [lensId, bodyId]))
    await repos.kits.update(travel.id, (saved) => addToKit(saved, [bodyId]))
    const names = async (gearId: string) =>
      (await current(repos.kits.withGear(gearId))).map(({ name }) => name).sort()
    expect(await names(lensId)).toEqual(['Wedding'])
    expect(await names(bodyId)).toEqual(['Travel', 'Wedding'])
    expect((await current(repos.kits.list())).map(({ name }) => name).sort()).toEqual([
      'Travel',
      'Wedding',
    ])
  })

  it('removes a kit, counting the change, and does nothing for one already gone', async () => {
    const { repos } = openRepositories()
    const kit = await repos.kits.add({ name: 'Wedding' })
    await repos.kits.remove(kit.id)
    expect(await current(repos.kits.get(kit.id))).toBeUndefined()
    expect(await changes(repos)).toBe(2)
    await repos.kits.remove(kit.id)
    expect(await changes(repos)).toBe(2)
  })
})
