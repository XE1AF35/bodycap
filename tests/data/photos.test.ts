// The photo repository on fake-indexeddb: photos belong to an item that exists and keep the order
// they were chosen in, each item keeps exactly one cover through every change, photos go when their
// item is deleted, and each change counts towards the backup reminder.
import { afterEach, describe, expect, it } from 'vitest'
import type { NewPhoto } from '@/core/photos'
import { readBackupFile } from '@/data/backup-file'
import { GearNotFoundError, RecordNotFoundError, RuleError } from '@/data/repositories'
import { body, closeDatabases, current, lens, NOW, openRepositories } from './support'

afterEach(closeDatabases)

const LATER = '2026-10-07T04:00:00.000Z'
/** A millisecond after NOW, when the second photo of a batch is added */
const NOW_AND_A_BIT = '2026-10-07T01:00:00.001Z'

const shrunk = (label: string, fields: Partial<NewPhoto> = {}): NewPhoto => ({
  image: new Blob([`image ${label}`], { type: 'image/webp' }),
  thumbnail: new Blob([`thumb ${label}`], { type: 'image/webp' }),
  mimeType: 'image/webp',
  width: 1600,
  height: 1067,
  ...fields,
})

/** An item with photos a and b, a being its cover */
async function withPhotos() {
  const opened = openRepositories()
  const item = await opened.repos.gear.add(body)
  const [a, b] = await opened.repos.photos.add(item.id, [shrunk('a'), shrunk('b')])
  if (a === undefined || b === undefined) throw new Error('Photos were not added')
  return { ...opened, item, a, b }
}

const changes = async ({ repos }: ReturnType<typeof openRepositories>) =>
  (await current(repos.settings.get())).changesSinceBackup

describe('photo repository', () => {
  it('adds photos in the order chosen, the first as the cover, counting each', async () => {
    const opened = openRepositories()
    const { repos } = opened
    const item = await repos.gear.add(body)
    const added = await repos.photos.add(item.id, [shrunk('a'), shrunk('b', { height: 900 })])
    expect(added).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000002',
        gearId: item.id,
        isCover: true,
        mimeType: 'image/webp',
        width: 1600,
        height: 1067,
        bytes: 7,
        thumbnailBytes: 7,
        thumbnail: expect.any(Blob) as unknown,
        createdAt: NOW,
        updatedAt: NOW,
      },
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000003',
        isCover: false,
        height: 900,
        createdAt: NOW_AND_A_BIT,
        updatedAt: NOW_AND_A_BIT,
      }) as unknown,
    ])
    const saved = await current(repos.photos.forGear(item.id))
    expect(saved.map(({ id }) => id)).toEqual(added.map(({ id }) => id))
    expect(await current(repos.photos.image(added[0]?.id ?? ''))).toEqual(expect.any(Blob))
    expect(await (await current(repos.photos.image(added[0]?.id ?? '')))?.text()).toBe('image a')
    expect(await saved[1]?.thumbnail.text()).toBe('thumb b')
    expect(saved[1]?.thumbnail.type).toBe('image/webp')
    expect(await changes(opened)).toBe(3)
  })

  it('adds later photos after the others, leaving the cover where it is', async () => {
    const opened = await withPhotos()
    opened.clock.now = LATER
    const [c] = await opened.repos.photos.add(opened.item.id, [shrunk('c')])
    expect(c).toMatchObject({ isCover: false, createdAt: LATER })
    const saved = await current(opened.repos.photos.forGear(opened.item.id))
    expect(saved.map(({ id, isCover }) => [id, isCover])).toEqual([
      [opened.a.id, true],
      [opened.b.id, false],
      [c?.id, false],
    ])
  })

  it('refuses photos for an item that is no longer there', async () => {
    const opened = openRepositories()
    await expect(opened.repos.photos.add('gone', [shrunk('a')])).rejects.toThrow(GearNotFoundError)
    expect(await changes(opened)).toBe(0)
  })

  it('refuses photos past the most an item can have, saving none of them', async () => {
    const opened = openRepositories()
    const item = await opened.repos.gear.add(body)
    const eleven = Array.from({ length: 11 }, (_, index) => shrunk(String(index)))
    await opened.repos.photos.add(item.id, eleven)
    const tooMany = opened.repos.photos.add(item.id, [shrunk('x'), shrunk('y')])
    await expect(tooMany).rejects.toThrow(
      new RuleError('This item has room for 1 more photo. Choose just one.'),
    )
    expect(await current(opened.repos.photos.forGear(item.id))).toHaveLength(11)
  })

  it('refuses a photo a backup would not take, saving none of the batch', async () => {
    const opened = openRepositories()
    const item = await opened.repos.gear.add(body)
    const tooWide = opened.repos.photos.add(item.id, [shrunk('a'), shrunk('b', { width: 1601 })])
    await expect(tooWide).rejects.toThrow(
      new RuleError("This photo couldn't be shrunk to save. Try another one."),
    )
    expect(await current(opened.repos.photos.forGear(item.id))).toEqual([])
  })

  it('moves the cover to the photo chosen, counting the change', async () => {
    const opened = await withPhotos()
    opened.clock.now = LATER
    await opened.repos.photos.setCover(opened.b.id)
    const saved = await current(opened.repos.photos.forGear(opened.item.id))
    expect(saved.map(({ isCover, updatedAt }) => [isCover, updatedAt])).toEqual([
      [false, LATER],
      [true, LATER],
    ])
    expect(await changes(opened)).toBe(4)
  })

  it('changes nothing when the photo chosen is already the cover', async () => {
    const opened = await withPhotos()
    await opened.repos.photos.setCover(opened.a.id)
    expect(await current(opened.repos.photos.forGear(opened.item.id))).toEqual([opened.a, opened.b])
    expect(await changes(opened)).toBe(3)
  })

  it('refuses to make a photo the cover once it has been deleted', async () => {
    const { repos } = openRepositories()
    await expect(repos.photos.setCover('gone')).rejects.toThrow(RecordNotFoundError)
  })

  it('deletes a photo, leaving the cover where it is', async () => {
    const opened = await withPhotos()
    await opened.repos.photos.remove(opened.b.id)
    expect(await current(opened.repos.photos.forGear(opened.item.id))).toEqual([opened.a])
    expect(await changes(opened)).toBe(4)
  })

  it('makes the oldest photo left the cover when the cover is deleted', async () => {
    const opened = await withPhotos()
    opened.clock.now = LATER
    await opened.repos.photos.add(opened.item.id, [shrunk('c')])
    await opened.repos.photos.remove(opened.a.id)
    const saved = await current(opened.repos.photos.forGear(opened.item.id))
    expect(saved.map(({ id, isCover }) => [id, isCover])).toEqual([
      [opened.b.id, true],
      [expect.any(String), false],
    ])
  })

  it("reads a photo's full-size image on its own, and none once it's deleted", async () => {
    const opened = await withPhotos()
    const image = await current(opened.repos.photos.image(opened.b.id))
    expect([await image?.text(), image?.type]).toEqual(['image b', 'image/webp'])
    await opened.repos.photos.remove(opened.b.id)
    expect(await current(opened.repos.photos.image(opened.b.id))).toBeUndefined()
    expect(await opened.db.photoImages.count()).toBe(1)
  })

  it('does nothing when the photo is already gone', async () => {
    const opened = await withPhotos()
    await opened.repos.photos.remove(opened.b.id)
    await opened.repos.photos.remove(opened.b.id)
    expect(await changes(opened)).toBe(4)
  })

  it("lists only an item's own photos, and each item's cover", async () => {
    const opened = await withPhotos()
    const zoom = await opened.repos.gear.add(lens)
    const [zoomCover] = await opened.repos.photos.add(zoom.id, [shrunk('z')])
    expect(await current(opened.repos.photos.forGear(zoom.id))).toEqual([zoomCover])
    expect(await current(opened.repos.photos.covers())).toEqual(
      new Map([
        [opened.item.id, opened.a],
        [zoom.id, zoomCover],
      ]),
    )
  })

  it('counts every photo, as photos come and go', async () => {
    const opened = await withPhotos()
    expect(await current(opened.repos.photos.count())).toBe(2)
    await opened.repos.photos.remove(opened.a.id)
    expect(await current(opened.repos.photos.count())).toBe(1)
  })

  it("deletes an item's photos with it, and no one else's", async () => {
    const opened = await withPhotos()
    const zoom = await opened.repos.gear.add(lens)
    const [zoomCover] = await opened.repos.photos.add(zoom.id, [shrunk('z')])
    await opened.repos.gear.remove(opened.item.id)
    expect(await opened.db.photos.toCollection().primaryKeys()).toEqual([zoomCover?.id])
    expect(await opened.db.photoImages.toCollection().primaryKeys()).toEqual([zoomCover?.id])
  })

  it('takes a restored backup as everything, so photos here go with the rest', async () => {
    const opened = await withPhotos()
    const file = await opened.repos.backup.create()
    const backup = await readBackupFile(new Blob([file.text]))
    if (!backup.ok) throw new Error(backup.error)
    await opened.repos.backup.restore(backup.value)
    expect(await opened.db.photos.count()).toBe(0)
    expect(await opened.db.photoImages.count()).toBe(0)
    expect(await current(opened.repos.photos.covers())).toEqual(new Map())
  })
})
