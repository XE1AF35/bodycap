// Backing up and restoring photos from the screens: Back up makes a .zip once there are photos and
// a .json until then, Settings can still leave photos out, and restoring a .zip shows and brings
// back its photos, with a warning when a backup without photos would replace the ones here.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { strToU8, zipSync, type Zippable } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBackup } from '@/core/backup/format'
import { formatDate, toIsoDate } from '@/core/dates'
import type { Gear, GearFields } from '@/core/gear'
import type { NewPhoto, PhotoInfo } from '@/core/photos'
import type { Live } from '@/data/repositories'
import type { Services } from '@/ui/services'
import { renderApp, stubDownloads, testServices } from './support'

afterEach(() => {
  vi.restoreAllMocks()
})

const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  status: 'owned',
}

const body: Gear = {
  id: '6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90',
  createdAt: '2026-03-02T01:00:00.000Z',
  updatedAt: '2026-03-02T01:00:00.000Z',
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T5',
  status: 'owned',
}

const photo = (id: string, isCover: boolean): PhotoInfo => ({
  id,
  createdAt: '2026-03-02T01:05:00.000Z',
  updatedAt: '2026-03-02T01:05:00.000Z',
  gearId: body.id,
  isCover,
  mimeType: 'image/webp',
  width: 1600,
  height: 1067,
  bytes: 5,
  thumbnailBytes: 5,
})

const photos = [
  photo('7a8b9c0d-1e2f-4a3b-8c5d-6e7f8a9b0c1d', true),
  photo('8b9c0d1e-2f3a-4b4c-9d6e-7f8a9b0c1d2e', false),
]

const NO_DATA = { gear: [body], kits: [], loans: [], maintenance: [], photos: [], settings: {} }
const INFO = { schemaVersion: 3, appVersion: '0.3.0', exportedAt: '2026-10-05T03:00:00.000Z' }
const madeOn = formatDate(toIsoDate(new Date(INFO.exportedAt)))

/** A .zip backup holding the body and its two photos, as Bodycap writes one */
function zipFile() {
  const data = createBackup({ ...NO_DATA, photos }, INFO)
  const entries: Zippable = {
    'data.json': strToU8(JSON.stringify(data)),
    ...Object.fromEntries(
      photos.flatMap(({ id }): [string, Uint8Array][] => [
        [`photos/${id}.webp`, strToU8('image')],
        [`thumbnails/${id}.webp`, strToU8('thumb')],
      ]),
    ),
  }
  return new File([zipSync(entries).slice()], 'bodycap-backup-2026-10-05.zip', {
    type: 'application/zip',
  })
}

/** A .json backup holding the body, and no photos */
const jsonFile = () =>
  new File([JSON.stringify(createBackup(NO_DATA, INFO))], 'bodycap-backup-2026-10-05.json', {
    type: 'application/json',
  })

const shrunk = (): NewPhoto => ({
  image: new Blob(['image'], { type: 'image/webp' }),
  thumbnail: new Blob(['thumb'], { type: 'image/webp' }),
  mimeType: 'image/webp',
  width: 1600,
  height: 1067,
})

/** The first value a live query gives */
function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}

/**
 * Services holding the lens, with `photoCount` photos of it. Making a .zip reads photos back from
 * storage, which jsdom's Blobs don't survive, so a stand-in makes it here. The data tests make
 * real ones.
 */
async function servicesWith(photoCount: number) {
  const base = testServices()
  const item = await base.repositories.gear.add(lens)
  if (photoCount > 0) {
    await base.repositories.photos.add(
      item.id,
      Array.from({ length: photoCount }, () => shrunk()),
    )
  }
  const createZip = vi.fn(() =>
    Promise.resolve({
      name: 'bodycap-backup-2026-10-09.zip',
      blob: new Blob(['zip'], { type: 'application/zip' }),
    }),
  )
  const services: Services = {
    ...base,
    repositories: {
      ...base.repositories,
      backup: { ...base.repositories.backup, createZip },
    },
  }
  return { services, createZip }
}

async function renderSettings(services: Services) {
  const view = renderApp('/settings', services)
  await screen.findByRole('heading', { level: 1, name: 'Settings' })
  return { ...view, user: userEvent.setup() }
}

const region = (name: string) => within(screen.getByRole('region', { name }))

describe('backing up photos', () => {
  it('backs up as a .json while there are no photos, with nothing to leave out', async () => {
    const saved = stubDownloads()
    const { services, createZip } = await servicesWith(0)
    const { user } = await renderSettings(services)
    await user.click(region('Backup').getByRole('button', { name: 'Back up now' }))
    await waitFor(() => {
      expect(saved.map(({ name }) => name)).toEqual([expect.stringMatching(/\.json$/)])
    })
    expect(createZip).not.toHaveBeenCalled()
    expect(region('Backup').queryByRole('button', { name: 'Back up without photos' })).toBeNull()
  })

  it('backs up photos too, as a .zip, once there are some', async () => {
    const saved = stubDownloads()
    const { services, createZip } = await servicesWith(2)
    const { user } = await renderSettings(services)
    const backup = region('Backup')
    await user.click(await backup.findByRole('button', { name: 'Back up now' }))
    expect(
      await backup.findByText('Backup saved as bodycap-backup-2026-10-09.zip.'),
    ).toBeInTheDocument()
    expect(createZip).toHaveBeenCalledOnce()
    expect(saved).toEqual([
      { name: 'bodycap-backup-2026-10-09.zip', blob: expect.any(Blob) as unknown },
    ])
    expect(saved[0]?.blob.type).toBe('application/zip')
  })

  it('can still back up everything but the photos, as a smaller .json', async () => {
    const saved = stubDownloads()
    const { services, createZip } = await servicesWith(2)
    const { user } = await renderSettings(services)
    const leaveOut = await region('Backup').findByRole('button', {
      name: 'Back up without photos',
    })
    expect(leaveOut).toHaveAccessibleDescription(
      'A .json file with everything but the photos, which is much smaller.',
    )
    await user.click(leaveOut)
    await waitFor(() => {
      expect(saved.map(({ name }) => name)).toEqual([expect.stringMatching(/\.json$/)])
    })
    expect(createZip).not.toHaveBeenCalled()
  })
})

describe('restoring photos', () => {
  async function choose(file: File, photoCount = 0) {
    const { services } = await servicesWith(photoCount)
    const view = await renderSettings(services)
    const input = screen.getByLabelText('Backup file')
    expect(input).toHaveAttribute('accept', '.json,.zip,application/json,application/zip')
    await view.user.upload(input, file)
    return { ...view, services }
  }

  it('shows the photos a .zip holds, and restores them with everything else', async () => {
    const { user, services } = await choose(zipFile())
    const restore = region('Restore')
    expect(
      await restore.findByText(`This backup was made on ${madeOn} and holds 1 item and 2 photos.`),
    ).toBeInTheDocument()
    await user.click(restore.getByRole('button', { name: 'Restore this backup' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Replace everything?' })
    expect(dialog).toHaveTextContent(
      "The 1 item here now will be replaced by the 1 item and 2 photos in the backup. This can't be undone.",
    )
    await user.click(within(dialog).getByRole('button', { name: 'Replace everything' }))
    expect(
      await screen.findByText(`Restored 1 item and 2 photos from the backup made on ${madeOn}.`),
    ).toBeInTheDocument()
    expect(await current(services.repositories.photos.count())).toBe(2)
  })

  it('warns that the photos here go when a backup without photos replaces them', async () => {
    const { user } = await choose(jsonFile(), 2)
    const restore = region('Restore')
    expect(
      await restore.findByText(
        "It replaces the 1 item and 2 photos here now, and can't be undone, so you may want a backup of what's here first. This backup has no photos, so the 2 photos here will go too.",
      ),
    ).toBeVisible()
    // Merging keeps what's here, so there's nothing to warn about
    await user.click(restore.getByRole('radio', { name: "Add to what's here" }))
    expect(restore.queryByText(/This backup has no photos/)).toBeNull()
  })

  it('counts the photos a merge adds', async () => {
    const { user } = await choose(zipFile())
    const restore = region('Restore')
    await user.click(await restore.findByRole('radio', { name: "Add to what's here" }))
    await user.click(restore.getByRole('button', { name: 'Restore this backup' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Merge this backup?' })
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }))
    expect(
      await screen.findByText(`Merged the backup made on ${madeOn}. Added 1 item and 2 photos.`),
    ).toBeInTheDocument()
  })
})
