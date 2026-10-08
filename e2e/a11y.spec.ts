// Accessibility: axe checks every screen against the WCAG 2.2 AA rules, in the dark and light themes.
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import {
  expect,
  open,
  openShareDialog,
  SAMPLE_COLLECTION,
  SAMPLE_GEAR,
  SAMPLE_SYSTEM,
  seed,
  test,
  type Seed,
} from './fixtures'

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze()
  // Each rule, the element at fault, and axe's explanation (such as the colours and ratio measured)
  expect(
    violations.flatMap(({ id, nodes }) =>
      nodes.map(({ target, any }) => `${id} on ${target.join(' ')}: ${any[0]?.message ?? ''}`),
    ),
  ).toEqual([])
}

interface Screen {
  readonly name: string
  /** What's in the database first, if anything */
  readonly seed?: Seed
  /** Gets the screen into the state to check, once the gear is in place */
  readonly show: (page: Page) => Promise<void>
}

/**
 * Opens a route and waits for that page's own heading. Changing only the part after the # leaves
 * the last page's heading showing for a moment, and axe mustn't check the page being left.
 */
async function at(page: Page, route: string, heading: string) {
  await open(page, route)
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
}

async function onPhone(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
}

async function atItem(page: Page, name = 'Fujifilm X-T5') {
  await at(page, '#/gear', 'Gear')
  await page.getByRole('table').getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

async function atKit(page: Page) {
  await at(page, '#/kits', 'Kits')
  await page.getByRole('link', { name: 'Wedding kit' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Wedding kit' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: '1 of 3 packed' })).toBeVisible()
}

/** Presses a button that opens a dialog, and waits for the dialog */
async function openDialog(page: Page, button: string, dialog: string) {
  await page.getByRole('button', { name: button }).click()
  await expect(page.getByRole('dialog', { name: dialog })).toBeVisible()
}

/** Backs up in Settings, then chooses that file to add to what's here */
async function chooseMerge(page: Page) {
  await at(page, '#/settings', 'Settings')
  const backup = page.getByRole('region', { name: 'Backup' })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    backup.getByRole('button', { name: 'Back up now' }).click(),
  ])
  const restore = page.getByRole('region', { name: 'Restore' })
  await restore.getByLabel('Backup file').setInputFiles(await download.path())
  await restore.getByRole('radio', { name: "Add to what's here" }).check()
  await expect(restore.getByText(/Anything deleted here since the backup was made/)).toBeVisible()
}

/** Opens the wedding kit's share link, in the same browser */
async function atSharedKit(page: Page) {
  const dialog = await openShareDialog(page)
  const link = await dialog.getByRole('textbox', { name: 'Link' }).inputValue()
  await page.goto(link)
  await expect(page.getByText(/A copy of a kit someone shared with you/)).toBeVisible()
}

const GEAR: Seed = { gear: SAMPLE_GEAR }

const SCREENS: readonly Screen[] = [
  { name: 'welcome', show: (page) => at(page, '#/', 'Welcome to Bodycap') },
  { name: 'dashboard', seed: GEAR, show: (page) => at(page, '#/', 'Dashboard') },
  { name: 'gear list', seed: GEAR, show: (page) => at(page, '#/gear', 'Gear') },
  {
    name: 'empty gear list',
    show: async (page) => {
      await at(page, '#/gear', 'Gear')
      await expect(page.getByText('Nothing on the shelf yet.')).toBeVisible()
    },
  },
  {
    name: 'gear list with no matches',
    seed: GEAR,
    show: async (page) => {
      await at(page, '#/gear?q=hasselblad', 'Gear')
      await expect(page.getByText('Nothing in frame.')).toBeVisible()
    },
  },
  {
    name: 'gear cards on a phone',
    seed: GEAR,
    show: async (page) => {
      await onPhone(page)
      await at(page, '#/gear', 'Gear')
      await expect(page.getByRole('list', { name: 'Your gear' })).toBeVisible()
    },
  },
  {
    name: 'open menu on a phone',
    show: async (page) => {
      await onPhone(page)
      await at(page, '#/', 'Welcome to Bodycap')
      await page.getByRole('button', { name: 'Menu' }).click()
      await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
    },
  },
  { name: 'gear detail', seed: GEAR, show: atItem },
  {
    name: 'delete dialog',
    seed: GEAR,
    show: async (page) => {
      await atItem(page)
      await page.getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'item not found',
    show: (page) => at(page, '#/gear/6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90', 'Item not found'),
  },
  { name: 'add form', show: (page) => at(page, '#/gear/new', 'Add gear') },
  {
    name: 'add form with errors',
    show: async (page) => {
      await at(page, '#/gear/new', 'Add gear')
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('heading', { name: "There's a problem" })).toBeVisible()
    },
  },
  {
    name: 'edit form',
    seed: GEAR,
    show: async (page) => {
      await atItem(page)
      await page.getByRole('link', { name: 'Edit' }).click()
      await expect(
        page.getByRole('heading', { level: 1, name: 'Edit Fujifilm X-T5' }),
      ).toBeVisible()
    },
  },
  { name: 'settings', seed: GEAR, show: (page) => at(page, '#/settings', 'Settings') },
  { name: 'not found', show: (page) => at(page, '#/nowhere', 'Page not found') },
  {
    name: 'header with the install button',
    show: async (page) => {
      await at(page, '#/', 'Welcome to Bodycap')
      // Chromium offers to install only once it's decided the site is worth it, so a stand-in
      await page.evaluate(() => {
        const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
          prompt: () => Promise.resolve(),
        })
        window.dispatchEvent(offer)
      })
      await expect(page.getByRole('button', { name: 'Install app' })).toBeVisible()
    },
  },
  {
    name: 'empty kits list',
    show: async (page) => {
      await at(page, '#/kits', 'Kits')
      await expect(page.getByText('No kits yet.')).toBeVisible()
    },
  },
  { name: 'kits list', seed: SAMPLE_COLLECTION, show: (page) => at(page, '#/kits', 'Kits') },
  { name: 'kit packing checklist', seed: SAMPLE_COLLECTION, show: atKit },
  {
    name: 'new kit dialog',
    show: async (page) => {
      await at(page, '#/kits', 'Kits')
      await openDialog(page, 'New kit', 'New kit')
    },
  },
  {
    name: 'add gear to a kit dialog',
    seed: SAMPLE_COLLECTION,
    show: async (page) => {
      await atKit(page)
      await openDialog(page, 'Add gear', 'Add gear to Wedding kit')
    },
  },
  {
    name: 'dashboard with an overdue loan',
    seed: SAMPLE_COLLECTION,
    show: async (page) => {
      await at(page, '#/', 'Dashboard')
      await expect(page.getByRole('region', { name: 'On loan' })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Needs attention' })).toBeVisible()
    },
  },
  {
    name: 'gear detail with a loan, kits, compatibility, and maintenance',
    seed: SAMPLE_COLLECTION,
    show: async (page) => {
      await atItem(page)
      for (const region of ['On loan to Aroha', 'Kits', 'Works with your lenses', 'Maintenance']) {
        await expect(page.getByRole('region', { name: region })).toBeVisible()
      }
    },
  },
  {
    name: 'lend dialog',
    seed: SAMPLE_COLLECTION,
    show: async (page) => {
      await atItem(page, 'Sony FE 24-70mm F2.8 GM II')
      await openDialog(page, 'Lend', 'Lend Sony FE 24-70mm F2.8 GM II')
    },
  },
  {
    name: 'return dialog',
    seed: SAMPLE_COLLECTION,
    show: async (page) => {
      await atItem(page)
      await openDialog(page, 'Returned', 'Fujifilm X-T5 is back')
    },
  },
  {
    name: 'maintenance dialog',
    seed: SAMPLE_COLLECTION,
    show: async (page) => {
      await atItem(page)
      await openDialog(page, 'Log work', 'Log work on Fujifilm X-T5')
    },
  },
  {
    name: 'share dialog',
    seed: SAMPLE_COLLECTION,
    show: async (page) => {
      await openShareDialog(page)
    },
  },
  { name: 'shared kit', seed: SAMPLE_COLLECTION, show: atSharedKit },
  {
    name: "shared link that can't be opened",
    show: (page) => at(page, '#/shared/not-a-kit', "This link can't be opened"),
  },
  {
    name: 'system map',
    seed: SAMPLE_SYSTEM,
    show: async (page) => {
      await at(page, '#/system', 'System map')
      await expect(page.getByRole('region', { name: 'Adapters' })).toBeVisible()
    },
  },
  {
    name: 'system map on a phone',
    seed: SAMPLE_SYSTEM,
    show: async (page) => {
      await onPhone(page)
      await at(page, '#/system', 'System map')
      await expect(page.getByRole('region', { name: 'Nikon Z6 III' })).toBeVisible()
    },
  },
  {
    name: 'empty system map',
    show: async (page) => {
      await at(page, '#/system', 'System map')
      await expect(page.getByText('Nothing to map yet.')).toBeVisible()
    },
  },
  {
    name: 'dashboard stats on a phone',
    seed: SAMPLE_COLLECTION,
    show: async (page) => {
      await onPhone(page)
      await at(page, '#/', 'Dashboard')
      await expect(page.getByRole('region', { name: 'Your gear in numbers' })).toBeVisible()
    },
  },
  { name: 'settings, merging a backup', seed: GEAR, show: chooseMerge },
  {
    name: 'merge confirmation',
    seed: GEAR,
    show: async (page) => {
      await chooseMerge(page)
      await page.getByRole('button', { name: 'Restore this backup' }).click()
      await expect(page.getByRole('alertdialog', { name: 'Merge this backup?' })).toBeVisible()
    },
  },
]

for (const theme of ['dark', 'light'] as const) {
  test.describe(`in the ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      // theme-init.js reads this before the first paint, as it would for someone who chose it
      await page.addInitScript((choice) => {
        localStorage.setItem('bodycap:theme', choice)
      }, theme)
    })

    for (const screen of SCREENS) {
      test(`the ${screen.name} screen passes axe`, async ({ page }) => {
        if (screen.seed !== undefined) await seed(page, screen.seed)
        await screen.show(page)
        await expect(page.locator('html')).toHaveClass(
          theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/,
        )
        await expectNoViolations(page)
      })
    }
  })
}
