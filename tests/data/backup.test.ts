// Backing up and restoring on fake-indexeddb: the exact round trip of gear, kits, loans,
// maintenance, and photos, as .json and as .zip, all-or-nothing restore and merge, and the backup
// reminder's bookkeeping.
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { readBackup } from '@/core/backup/read'
import type { GearFields } from '@/core/gear'
import { addToKit, setChecklist } from '@/core/kits'
import type { NewPhoto } from '@/core/photos'
import { readBackupFile } from '@/data/backup-file'
import { BodycapDatabase } from '@/data/db'
import { createRepositories } from '@/data/dexie-repositories'
import type { Live, PhotoWithBytes, RestorableBackup } from '@/data/repositories'

const EXPORTED_AT = '2026-10-04T12:30:00.000Z'

const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  serialNumber: 'ab-12 34',
  mount: 'sony-e',
  lensCoverage: 'full-frame',
  purchaseDate: '2026-03-01',
  purchasePrice: { amountMinor: 389900, currency: 'NZD' },
  status: 'owned',
  notes: 'Bought with the hood\nand a spare cap',
}

const soldBody: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T4',
  mount: 'fujifilm-x',
  sensorFormat: 'aps-c',
  status: 'sold',
  saleDate: '2026-09-20',
  salePrice: { amountMinor: 120000, currency: 'AUD' },
}

const adapter: GearFields = {
  category: 'mount-adapter',
  brand: 'Nikon',
  model: 'FTZ II',
  adapterFrom: 'nikon-f',
  adapterTo: 'nikon-z',
  adapterAutofocus: true,
  purchasePrice: { amountMinor: 45000, currency: 'JPY' },
  status: 'lent-out',
}

const opened: BodycapDatabase[] = []
let ids = 0

afterEach(() => {
  for (const db of opened.splice(0)) db.close()
})

/** A new, empty database with its repositories, on a clock that stays put until it's moved */
function open() {
  const db = new BodycapDatabase({ indexedDB: new IDBFactory(), IDBKeyRange })
  opened.push(db)
  const clock = { now: EXPORTED_AT }
  const repos = createRepositories(db, {
    now: () => new Date(clock.now),
    newId: () => {
      ids += 1
      return `00000000-0000-4000-8000-${String(ids).padStart(12, '0')}`
    },
    appVersion: '0.1.0',
    // 12:30 UTC is 1:30 the next morning in New Zealand, so the file is named for the 5th
    timeZone: 'Pacific/Auckland',
  })
  return { db, repos, clock }
}

/** Reads a backup as the restore screen does */
async function chosen(contents: string | Blob): Promise<RestorableBackup> {
  const read = await readBackupFile(new Blob([contents]))
  if (!read.ok) throw new Error(read.error)
  return read.value
}

/** The first value a live query gives */
function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}

/** A database holding three items and a remembered currency, backed up */
async function backedUp() {
  const source = open()
  const gear = [
    await source.repos.gear.add(lens),
    await source.repos.gear.add(soldBody),
    await source.repos.gear.add(adapter),
  ]
  const [first, second, third] = gear.map(({ id }) => id)
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error('The gear was not added')
  }
  const kit = await source.repos.kits.add({ name: 'Travel light' })
  await source.repos.kits.update(kit.id, (saved) =>
    setChecklist(addToKit(saved, [first, third]), true),
  )
  // Lent and given back, so the lens is owned again, as it was added
  const loan = await source.repos.loans.lend(first, { borrower: 'Aroha', dateOut: '2026-10-01' })
  await source.repos.loans.giveBack(loan.id, '2026-10-03')
  await source.repos.maintenance.add(second, { type: 'sensor-clean', date: '2026-09-01' })
  await source.repos.settings.setLastUsedCurrency('AUD')
  const file = await source.repos.backup.create()
  return { source, gear, file, backup: await chosen(file.text) }
}

describe('backup.create', () => {
  it('makes a file named for the local date, holding every item and portable setting', async () => {
    const { file, gear, backup, source } = await backedUp()
    expect(file.name).toBe('bodycap-backup-2026-10-05.json')
    expect(backup).toEqual({
      app: 'bodycap',
      formatVersion: 3,
      schemaVersion: 3,
      appVersion: '0.1.0',
      exportedAt: EXPORTED_AT,
      counts: { gear: 3, kits: 1, loans: 1, maintenance: 1, photos: 0 },
      data: {
        gear,
        kits: await source.db.kits.toArray(),
        loans: await source.db.loans.toArray(),
        maintenance: await source.db.maintenance.toArray(),
        photos: [],
        settings: { lastUsedCurrency: 'AUD' },
      },
      storedPhotos: [],
    })
  })

  it("records the app's version from the build by default", async () => {
    const db = new BodycapDatabase({ indexedDB: new IDBFactory(), IDBKeyRange })
    opened.push(db)
    const file = await createRepositories(db).backup.create()
    expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+/)
    expect(readBackup(file.text)).toMatchObject({
      ok: true,
      value: { appVersion: __APP_VERSION__ },
    })
  })

  it('records the backup, then counts changes from zero again', async () => {
    const { source } = await backedUp()
    expect(await current(source.repos.settings.get())).toEqual({
      lastBackupAt: EXPORTED_AT,
      changesSinceBackup: 0,
      lastUsedCurrency: 'AUD',
    })
    await source.repos.gear.add(lens)
    expect(await current(source.repos.settings.get())).toMatchObject({ changesSinceBackup: 1 })
  })
})

describe('backup.restore', () => {
  it('restores exactly what was backed up into another database', async () => {
    const { source, backup } = await backedUp()
    const target = open()
    await target.repos.backup.restore(backup)
    for (const table of ['gear', 'kits', 'loans', 'maintenance'] as const) {
      expect(await target.db[table].toArray(), table).toEqual(await source.db[table].toArray())
    }
    expect(await current(target.repos.gear.list())).toEqual(await current(source.repos.gear.list()))
    expect(await target.db.gear.where('serialKey').equals('AB1234').count()).toBe(1)
  })

  it('replaces everything already there, settings included', async () => {
    const { backup } = await backedUp()
    const target = open()
    await target.repos.gear.add({ ...lens, model: 'FE 85mm F1.8' })
    await target.repos.settings.setLastUsedCurrency('USD')
    const withoutCurrency = { ...backup, data: { ...backup.data, settings: {} } }
    await target.repos.backup.restore(withoutCurrency)
    expect(await current(target.repos.gear.list())).toEqual(backup.data.gear)
    expect(await current(target.repos.settings.get())).not.toHaveProperty('lastUsedCurrency')
  })

  it('counts the restored data as backed up when the file was made', async () => {
    const { backup } = await backedUp()
    const target = open()
    await target.repos.gear.add(lens)
    await target.repos.backup.restore({ ...backup, exportedAt: '2026-09-01T00:00:00.000Z' })
    expect(await current(target.repos.settings.get())).toEqual({
      lastBackupAt: '2026-09-01T00:00:00.000Z',
      changesSinceBackup: 0,
      lastUsedCurrency: 'AUD',
    })
  })

  it('leaves everything as it was when a restore fails part way through', async () => {
    const { backup } = await backedUp()
    const target = open()
    const kept = await target.repos.gear.add({ ...lens, model: 'FE 85mm F1.8' })
    await target.repos.settings.setLastUsedCurrency('USD')
    const [first] = backup.data.gear
    if (first === undefined) throw new Error('The backup has no gear')
    // readBackup refuses repeated IDs, so this can only come from a bug, but the write must still
    // be all or nothing
    const broken: RestorableBackup = {
      ...backup,
      counts: { ...backup.counts, gear: 2 },
      data: { ...backup.data, gear: [first, first] },
    }
    await expect(target.repos.backup.restore(broken)).rejects.toThrow()
    expect(await current(target.repos.gear.list())).toEqual([kept])
    expect(await current(target.repos.settings.get())).toEqual({
      changesSinceBackup: 1,
      lastUsedCurrency: 'USD',
    })
  })

  it('replaces kits, loans, and maintenance already there with those in the backup', async () => {
    const { backup } = await backedUp()
    const target = open()
    const item = await target.repos.gear.add({ ...lens, model: 'FE 85mm F1.8' })
    await target.repos.kits.add({ name: 'Old kit' })
    await target.repos.maintenance.add(item.id, { type: 'repair', date: '2026-08-01' })
    await target.repos.backup.restore(backup)
    expect(await target.db.kits.toArray()).toEqual(backup.data.kits)
    expect(await target.db.loans.toArray()).toEqual(backup.data.loans)
    expect(await target.db.maintenance.toArray()).toEqual(backup.data.maintenance)
  })
})

const shrunk = (label: string): NewPhoto => ({
  image: new Blob([`image ${label}`], { type: 'image/webp' }),
  thumbnail: new Blob([`thumb ${label}`], { type: 'image/webp' }),
  mimeType: 'image/webp',
  width: 1600,
  height: 1067,
})

const text = (bytes: ArrayBuffer | undefined) => new TextDecoder().decode(bytes)

/** Every photo a database holds, with its two images as text, so two copies can be compared */
async function storedPhotos(db: BodycapDatabase) {
  const images = new Map((await db.photoImages.toArray()).map(({ id, image }) => [id, image]))
  return (await db.photos.toArray()).map(({ thumbnail, ...info }) => ({
    ...info,
    image: text(images.get(info.id)),
    thumbnail: text(thumbnail),
  }))
}

/** A backup's photos in the same form */
const backedUpPhotos = (photos: readonly PhotoWithBytes[]) =>
  photos.map(({ image, thumbnail, ...info }) => ({
    ...info,
    image: text(image),
    thumbnail: text(thumbnail),
  }))

/** A database holding a body with two photos and a lens with one, backed up as a .zip */
async function zipped() {
  const source = open()
  const camera = await source.repos.gear.add(soldBody)
  const zoom = await source.repos.gear.add(lens)
  await source.repos.photos.add(camera.id, [shrunk('front'), shrunk('top')])
  await source.repos.photos.add(zoom.id, [shrunk('zoom')])
  const archive = await source.repos.backup.createZip()
  return { source, camera, zoom, archive, backup: await chosen(archive.blob) }
}

describe('backup.createZip', () => {
  it('makes a .zip named for the local date, holding the data and every photo', async () => {
    const { source, archive, backup } = await zipped()
    expect(archive.name).toBe('bodycap-backup-2026-10-05.zip')
    expect(archive.blob.type).toBe('application/zip')
    expect(backup.counts).toEqual({ gear: 2, kits: 0, loans: 0, maintenance: 0, photos: 3 })
    expect(backedUpPhotos(backup.storedPhotos)).toEqual(await storedPhotos(source.db))
  })

  it('records the backup, then counts changes from zero again', async () => {
    const { source } = await zipped()
    expect(await current(source.repos.settings.get())).toEqual({
      lastBackupAt: EXPORTED_AT,
      changesSinceBackup: 0,
    })
  })

  it('counts a change saved while the .zip is being made once it is done, and leaves it out', async () => {
    const source = open()
    const camera = await source.repos.gear.add(soldBody)
    await source.repos.photos.add(camera.id, [shrunk('front')])
    const making = source.repos.backup.createZip()
    const saving = source.repos.gear.add(lens)
    const [archive] = await Promise.all([making, saving])
    expect((await chosen(archive.blob)).counts.gear).toBe(1)
    expect(await current(source.repos.settings.get())).toMatchObject({ changesSinceBackup: 1 })
  })
})

describe('restoring and merging photos', () => {
  it('restores every photo from a .zip exactly, replacing the photos here', async () => {
    const { source, backup } = await zipped()
    const target = open()
    const item = await target.repos.gear.add(adapter)
    await target.repos.photos.add(item.id, [shrunk('old')])
    await target.repos.backup.restore(backup)
    expect(await storedPhotos(target.db)).toEqual(await storedPhotos(source.db))
    expect(await current(target.repos.gear.list())).toEqual(await current(source.repos.gear.list()))
  })

  it('leaves everything as it was when restoring photos fails part way through', async () => {
    const { backup } = await zipped()
    const target = open()
    const item = await target.repos.gear.add(adapter)
    await target.repos.photos.add(item.id, [shrunk('kept')])
    const before = await storedPhotos(target.db)
    const [first] = backup.storedPhotos
    if (first === undefined) throw new Error('The backup has no photos')
    await expect(
      target.repos.backup.restore({ ...backup, storedPhotos: [first, first] }),
    ).rejects.toThrow()
    expect(await storedPhotos(target.db)).toEqual(before)
    expect(await current(target.repos.gear.list())).toEqual([item])
  })

  it('merges photos from a .zip, adding them and counting each', async () => {
    const { backup } = await zipped()
    const target = open()
    const summary = await target.repos.backup.merge(backup)
    expect(summary).toEqual({
      added: { gear: 2, kits: 0, loans: 0, maintenance: 0, photos: 3 },
      updated: { gear: 0, kits: 0, loans: 0, maintenance: 0, photos: 0 },
    })
    expect(await storedPhotos(target.db)).toEqual(backedUpPhotos(backup.storedPhotos))
    expect(await current(target.repos.settings.get())).toMatchObject({ changesSinceBackup: 5 })
    // The same backup again changes nothing
    expect(await target.repos.backup.merge(backup)).toMatchObject({
      added: { photos: 0 },
      updated: { photos: 0 },
    })
  })

  it("makes the backup's older cover the item's cover, and the one here a plain photo", async () => {
    const source = open()
    const camera = await source.repos.gear.add(soldBody)
    const beforePhotos = await chosen((await source.repos.backup.create()).text)
    await source.repos.photos.add(camera.id, [shrunk('older')])
    const withPhotos = await chosen((await source.repos.backup.createZip()).blob)

    const target = open()
    await target.repos.backup.restore(beforePhotos)
    target.clock.now = '2026-10-04T13:00:00.000Z'
    const [newer] = await target.repos.photos.add(camera.id, [shrunk('newer')])
    await target.repos.backup.merge(withPhotos)

    const photos = await current(target.repos.photos.forGear(camera.id))
    expect(photos.map(({ id, isCover }) => [id, isCover])).toEqual([
      [withPhotos.data.photos[0]?.id, true],
      [newer?.id, false],
    ])
  })
})
