// Settings: backups and how soon to be reminded, restoring by replacing or merging with a preview
// and confirmation, the currency new amounts start in, storage, the theme, and About.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageState } from '@/core/alerts'
import { createBackup } from '@/core/backup/format'
import { formatDate, toIsoDate } from '@/core/dates'
import type { Gear, GearFields } from '@/core/gear'
import type { Live } from '@/data/repositories'
import type { StorageHelpers } from '@/data/storage'
import { renderApp, stubDownloads, testServices } from './support'

const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  status: 'owned',
}

const backedUpGear: Gear[] = [
  {
    id: '6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90',
    createdAt: '2026-03-02T01:00:00.000Z',
    updatedAt: '2026-03-02T01:00:00.000Z',
    category: 'camera-body',
    brand: 'Fujifilm',
    model: 'X-T5',
    status: 'owned',
  },
  {
    id: '0b7e2d14-8c3a-4e6f-a1d9-2f5c8b3e7a60',
    createdAt: '2026-04-11T22:30:00.000Z',
    updatedAt: '2026-04-11T22:30:00.000Z',
    category: 'lens',
    brand: 'Fujifilm',
    model: 'XF 33mm F1.4 R LM WR',
    status: 'owned',
  },
]

const backup = createBackup(
  { gear: backedUpGear, kits: [], loans: [], maintenance: [], photos: [], settings: {} },
  { schemaVersion: 1, appVersion: '0.1.0', exportedAt: '2026-10-05T03:00:00.000Z' },
)

// The day the backup was made where the tests run, as the app shows it
const madeOn = formatDate(toIsoDate(new Date(backup.exportedAt)))

const backupFile = () =>
  new File([JSON.stringify(backup)], 'bodycap-backup-2026-10-05.json', { type: 'application/json' })

/** The first value a live query gives */
function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}

const storageOf = (state: StorageState, persist = vi.fn(() => Promise.resolve(true))) => ({
  persist,
  helpers: {
    requestPersistence: persist,
    storageState: () => Promise.resolve(state),
  } satisfies StorageHelpers,
})

async function renderSettings(services = testServices()) {
  const view = renderApp('/settings', services)
  await screen.findByRole('heading', { level: 1, name: 'Settings' })
  return { ...view, user: userEvent.setup() }
}

const region = (name: string) => within(screen.getByRole('region', { name }))

beforeEach(() => {
  document.documentElement.className = 'dark'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('backup', () => {
  it('says when there has never been a backup', async () => {
    await renderSettings()
    expect(await region('Backup').findByText("You haven't made a backup yet.")).toBeInTheDocument()
    expect(region('Backup').getByRole('button', { name: 'Back up now' })).toBeInTheDocument()
  })

  it('says how long ago the last backup was, and how many changes since', async () => {
    const services = testServices()
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    await services.repositories.backup.restore({
      ...backup,
      exportedAt: threeDaysAgo,
      storedPhotos: [],
    })
    await services.repositories.gear.add(lens)
    await renderSettings(services)
    expect(await region('Backup').findByText('Last backup: 3 days ago.')).toBeInTheDocument()
    expect(region('Backup').getByText('1 change since then.')).toBeInTheDocument()
  })
})

describe('preferences', () => {
  it('starts new amounts in the currency chosen here, until it goes back to the last one used', async () => {
    const { user, services } = await renderSettings()
    const currency = region('Currency').getByRole('combobox', { name: 'Start new amounts in' })
    expect(currency).toHaveValue('')
    await user.selectOptions(currency, 'AUD')
    await waitFor(async () => {
      expect((await current(services.repositories.settings.get())).defaultCurrency).toBe('AUD')
    })
    expect(currency).toHaveValue('AUD')

    await user.click(screen.getByRole('link', { name: 'Gear' }))
    await user.click(await screen.findByRole('link', { name: 'Add gear' }))
    const price = within(await screen.findByRole('group', { name: 'Purchase price' }))
    expect(price.getByRole('combobox', { name: 'Currency' })).toHaveValue('AUD')

    await user.click(screen.getByRole('link', { name: 'Settings' }))
    await user.selectOptions(
      await region('Currency').findByRole('combobox', { name: 'Start new amounts in' }),
      'The currency I used last',
    )
    await waitFor(async () => {
      expect(await current(services.repositories.settings.get())).not.toHaveProperty(
        'defaultCurrency',
      )
    })
  })

  it('reminds about backups after the time chosen here', async () => {
    const services = testServices()
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toISOString()
    await services.repositories.backup.restore({
      ...backup,
      exportedAt: eightDaysAgo,
      storedPhotos: [],
    })
    await services.repositories.gear.add(lens)
    const { user } = await renderSettings(services)
    const remind = region('Backup').getByRole('combobox', { name: 'Remind me to back up' })
    expect(remind).toHaveValue('14')
    await user.selectOptions(remind, 'A week after the last one')
    await waitFor(async () => {
      expect((await current(services.repositories.settings.get())).backupReminderDays).toBe(7)
    })
    await user.click(screen.getByRole('link', { name: 'Dashboard' }))
    expect(await screen.findByText(/Your last backup was 8 days ago/)).toBeVisible()
  })
})

describe('restore', () => {
  async function chooseBackup(services = testServices(), file = backupFile()) {
    await services.repositories.gear.add(lens)
    const view = await renderSettings(services)
    await view.user.upload(screen.getByLabelText('Backup file'), file)
    return { ...view, services }
  }

  it('shows what a chosen backup holds before anything changes', async () => {
    const { services } = await chooseBackup()
    const restore = region('Restore')
    expect(
      await restore.findByText(`This backup was made on ${madeOn} and holds 2 items.`),
    ).toBeInTheDocument()
    expect(restore.getByText(/It replaces the 1 item here now/)).toBeInTheDocument()
    expect(await current(services.repositories.gear.list())).toMatchObject([lens])
  })

  it('replaces everything once the person confirms', async () => {
    const { user, services } = await chooseBackup()
    await user.click(await region('Restore').findByRole('button', { name: 'Restore this backup' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Replace everything?' })
    await user.click(within(dialog).getByRole('button', { name: 'Replace everything' }))
    // The page is hidden from assistive technology until the dialog has finished closing
    expect(
      await screen.findByText(`Restored 2 items from the backup made on ${madeOn}.`),
    ).toBeInTheDocument()
    // The list comes in no particular order, so both sides are sorted the same way
    const byId = (a: Gear, b: Gear) => a.id.localeCompare(b.id)
    expect([...(await current(services.repositories.gear.list()))].sort(byId)).toEqual(
      [...backedUpGear].sort(byId),
    )
  })

  it('adds a backup to what is here when merging, after saying what that means', async () => {
    const { user, services } = await chooseBackup()
    const restore = region('Restore')
    await user.click(await restore.findByRole('radio', { name: "Add to what's here" }))
    expect(
      restore.getByText(/Anything deleted here since the backup was made comes back/),
    ).toBeVisible()
    await user.click(restore.getByRole('button', { name: 'Restore this backup' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Merge this backup?' })
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }))
    expect(
      await screen.findByText(`Merged the backup made on ${madeOn}. Added 2 items.`),
    ).toBeInTheDocument()
    expect(await current(services.repositories.gear.list())).toHaveLength(3)
  })

  it('changes nothing when the person keeps what is there', async () => {
    const { user, services } = await chooseBackup()
    await user.click(await region('Restore').findByRole('button', { name: 'Restore this backup' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Replace everything?' })
    await user.click(within(dialog).getByRole('button', { name: "Keep what's here" }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await current(services.repositories.gear.list())).toMatchObject([lens])
  })

  it('offers to back up what is here first', async () => {
    const saved = stubDownloads()
    const { user } = await chooseBackup()
    await user.click(
      await region('Restore').findByRole('button', {
        name: "Download a backup of what's here now",
      }),
    )
    await waitFor(() => {
      expect(saved).toHaveLength(1)
    })
  })

  it('explains why a file cannot be restored, and changes nothing', async () => {
    const notABackup = new File(['Shopping list'], 'notes.json', { type: 'application/json' })
    const { services } = await chooseBackup(testServices(), notABackup)
    expect(await region('Restore').findByRole('alert')).toHaveTextContent(
      "This file isn't a Bodycap backup.",
    )
    expect(region('Restore').queryByRole('button', { name: 'Restore this backup' })).toBeNull()
    expect(await current(services.repositories.gear.list())).toMatchObject([lens])
  })

  it('says nothing was changed when the restore itself fails', async () => {
    const services = testServices()
    const failing = {
      ...services,
      repositories: {
        ...services.repositories,
        backup: {
          ...services.repositories.backup,
          restore: () => Promise.reject(new Error('The disk is on fire')),
        },
      },
    }
    const { user } = await chooseBackup(failing)
    await user.click(await region('Restore').findByRole('button', { name: 'Restore this backup' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Replace everything' }))
    expect(await region('Restore').findByRole('alert')).toHaveTextContent(
      "The restore didn't work, so nothing was changed.",
    )
  })
})

describe('storage', () => {
  it('shows how much space is used, and that the browser will keep the data', async () => {
    const { helpers } = storageOf({ usage: 2_400_000, quota: 120_000_000_000, persisted: true })
    await renderSettings(testServices({ storage: helpers }))
    const storage = region('Storage')
    expect(
      await storage.findByText('Bodycap is using 2.4 MB of the 120 GB this browser allows it.'),
    ).toBeInTheDocument()
    expect(
      storage.getByText("This browser has promised to keep Bodycap's data."),
    ).toBeInTheDocument()
    expect(storage.queryByRole('button', { name: 'Ask the browser to keep it' })).toBeNull()
  })

  it('warns when storage is nearly full', async () => {
    const { helpers } = storageOf({ usage: 85_000_000, quota: 100_000_000, persisted: true })
    await renderSettings(testServices({ storage: helpers }))
    expect(await region('Storage').findByText(/Storage is nearly full/)).toBeInTheDocument()
  })

  it.each([
    [true, "This browser has promised to keep Bodycap's data."],
    [false, "The browser didn't agree this time. Backups keep your gear safe either way."],
  ])('asks the browser to keep the data, and says what it answered: %s', async (answer, said) => {
    const persist = vi.fn(() => Promise.resolve(answer))
    const { helpers } = storageOf({ usage: 10, quota: 100, persisted: false }, persist)
    const { user } = await renderSettings(testServices({ storage: helpers }))
    const storage = region('Storage')
    expect(
      await storage.findByText(/hasn't promised to keep Bodycap's data yet/),
    ).toBeInTheDocument()
    await user.click(storage.getByRole('button', { name: 'Ask the browser to keep it' }))
    expect(await storage.findByText(said)).toBeInTheDocument()
    expect(persist).toHaveBeenCalledOnce()
  })

  it('explains how a browser can lose data, and what keeps it safe', async () => {
    await renderSettings()
    const storage = region('Storage')
    expect(storage.getByText(/Safari deletes a site's data after 7 days/)).toBeInTheDocument()
    expect(storage.getByText(/Add to Home Screen/)).toBeInTheDocument()
  })
})

describe('theme and about', () => {
  it('switches the theme', async () => {
    const { user } = await renderSettings()
    await user.click(region('Theme').getByRole('radio', { name: 'Light' }))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(screen.getByRole('button', { name: 'Dark theme' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await user.click(region('Theme').getByRole('radio', { name: 'Dark' }))
    expect(document.documentElement).toHaveClass('dark')
  })

  it('says which version this is, and that nothing leaves the browser', async () => {
    await renderSettings()
    const about = region('About')
    expect(about.getByText(`Version ${__APP_VERSION__}`)).toBeInTheDocument()
    expect(about.getByText(/Nothing is sent anywhere/)).toBeInTheDocument()
  })
})
