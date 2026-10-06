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

const SCREENS: readonly Screen[] = [
  { name: 'welcome', seeded: false, show: (page) => open(page) },
  { name: 'dashboard', seeded: true, show: (page) => open(page) },
  { name: 'gear list', seeded: true, show: (page) => open(page, '#/gear') },
  {
    name: 'gear detail',
    seeded: true,
    show: async (page) => {
      await open(page, '#/gear')
      await page.getByRole('table').getByRole('link', { name: 'Fujifilm X-T5' }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Fujifilm X-T5' })).toBeVisible()
    },
  },
  {
    name: 'delete dialog',
    seeded: true,
    show: async (page) => {
      await open(page, '#/gear')
      await page.getByRole('table').getByRole('link', { name: 'Fujifilm X-T5' }).click()
      await page.getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  { name: 'add form', seeded: false, show: (page) => open(page, '#/gear/new') },
  {
    name: 'add form with errors',
    seeded: false,
    show: async (page) => {
      await open(page, '#/gear/new')
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('heading', { name: "There's a problem" })).toBeVisible()
    },
  },
  { name: 'settings', seeded: true, show: (page) => open(page, '#/settings') },
  { name: 'not found', seeded: false, show: (page) => open(page, '#/nowhere') },
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
