// Accessibility: axe checks every screen against the WCAG 2.2 AA rules, in the dark and light themes.
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, open, SAMPLE_GEAR, seedGear, test } from './fixtures'

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
  readonly seeded: boolean
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

async function atItem(page: Page) {
  await at(page, '#/gear', 'Gear')
  await page.getByRole('table').getByRole('link', { name: 'Fujifilm X-T5' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fujifilm X-T5' })).toBeVisible()
}

const SCREENS: readonly Screen[] = [
  { name: 'welcome', seeded: false, show: (page) => at(page, '#/', 'Welcome to Bodycap') },
  { name: 'dashboard', seeded: true, show: (page) => at(page, '#/', 'Dashboard') },
  { name: 'gear list', seeded: true, show: (page) => at(page, '#/gear', 'Gear') },
  {
    name: 'empty gear list',
    seeded: false,
    show: async (page) => {
      await at(page, '#/gear', 'Gear')
      await expect(page.getByText('Nothing on the shelf yet.')).toBeVisible()
    },
  },
  {
    name: 'gear list with no matches',
    seeded: true,
    show: async (page) => {
      await at(page, '#/gear?q=hasselblad', 'Gear')
      await expect(page.getByText('Nothing in frame.')).toBeVisible()
    },
  },
  {
    name: 'gear cards on a phone',
    seeded: true,
    show: async (page) => {
      await onPhone(page)
      await at(page, '#/gear', 'Gear')
      await expect(page.getByRole('list', { name: 'Your gear' })).toBeVisible()
    },
  },
  {
    name: 'open menu on a phone',
    seeded: false,
    show: async (page) => {
      await onPhone(page)
      await at(page, '#/', 'Welcome to Bodycap')
      await page.getByRole('button', { name: 'Menu' }).click()
      await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
    },
  },
  { name: 'gear detail', seeded: true, show: atItem },
  {
    name: 'delete dialog',
    seeded: true,
    show: async (page) => {
      await atItem(page)
      await page.getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'item not found',
    seeded: false,
    show: (page) => at(page, '#/gear/6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90', 'Item not found'),
  },
  { name: 'add form', seeded: false, show: (page) => at(page, '#/gear/new', 'Add gear') },
  {
    name: 'add form with errors',
    seeded: false,
    show: async (page) => {
      await at(page, '#/gear/new', 'Add gear')
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('heading', { name: "There's a problem" })).toBeVisible()
    },
  },
  {
    name: 'edit form',
    seeded: true,
    show: async (page) => {
      await atItem(page)
      await page.getByRole('link', { name: 'Edit' }).click()
      await expect(
        page.getByRole('heading', { level: 1, name: 'Edit Fujifilm X-T5' }),
      ).toBeVisible()
    },
  },
  { name: 'settings', seeded: true, show: (page) => at(page, '#/settings', 'Settings') },
  { name: 'not found', seeded: false, show: (page) => at(page, '#/nowhere', 'Page not found') },
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
        if (screen.seeded) await seedGear(page, SAMPLE_GEAR)
        await screen.show(page)
        await expect(page.locator('html')).toHaveClass(
          theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/,
        )
        await expectNoViolations(page)
      })
    }
  })
}
