// Shared setup for the end-to-end tests. Every test fails on a console error, an uncaught error, or
// a Content Security Policy or Trusted Types violation, so a problem anywhere is caught wherever it
// happens, not only in a test written to look for it.
import { test as base, expect, type Locator, type Page } from '@playwright/test'

/** Starts recording problems on a page, returning the list they're added to */
export function watchForProblems(page: Page): string[] {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`Console error: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    problems.push(`Uncaught error: ${error.message}`)
  })
  return problems
}

interface Options {
  /** Problems a test expects to cause, such as the one checking violations are caught */
  readonly allowedProblems: readonly RegExp[]
}

export const test = base.extend<Options & { problemWatch: undefined }>({
  allowedProblems: [[], { option: true }],
  problemWatch: [
    async ({ page, allowedProblems }, use) => {
      // Browsers report violations to the console themselves, but this names the directive too
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          console.error(`Policy violation: ${event.violatedDirective} (${event.blockedURI})`)
        })
      })
      const problems = watchForProblems(page)
      await use(undefined)
      expect(
        problems.filter((problem) => !allowedProblems.some((allowed) => allowed.test(problem))),
      ).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/**
 * Presses Tab until the target has focus, as someone using only a keyboard would. Fails if it
 * isn't reached, which means it can't be reached by keyboard.
 */
export async function tabTo(page: Page, target: Locator, limit = 60): Promise<void> {
  for (let presses = 0; presses < limit; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Couldn't reach ${target.toString()} with Tab in ${String(limit)} presses`)
}

/** The app at a hash route, once its page heading is showing */
export async function open(page: Page, route = '#/'): Promise<void> {
  await page.goto(`./${route}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

export interface SeedItem {
  readonly category: string
  readonly brand: string
  readonly model: string
  readonly status: string
  readonly [field: string]: unknown
}

/**
 * Saves gear straight into the app's database, then reloads so the app reads it. Faster than
 * typing each item in, for tests about something else.
 */
export async function seedGear(page: Page, items: readonly SeedItem[]): Promise<void> {
  await open(page)
  const now = new Date().toISOString()
  const records = items.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }))
  await page.evaluate(async (gear) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bodycap')
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB would not open'))
      }
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('gear', 'readwrite')
      for (const record of gear) transaction.objectStore('gear').put(record)
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error ?? new Error('The gear was not saved'))
      }
    })
    db.close()
  }, records)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

export const SAMPLE_GEAR: readonly SeedItem[] = [
  {
    category: 'lens',
    brand: 'Sony',
    model: 'FE 24-70mm F2.8 GM II',
    mount: 'sony-e',
    purchaseDate: '2026-03-01',
    purchasePrice: { amountMinor: 389900, currency: 'NZD' },
    status: 'owned',
  },
  {
    category: 'camera-body',
    brand: 'Fujifilm',
    model: 'X-T5',
    mount: 'fujifilm-x',
    sensorFormat: 'aps-c',
    purchasePrice: { amountMinor: 299900, currency: 'NZD' },
    status: 'lent-out',
  },
  { category: 'bag', brand: 'Peak Design', model: 'Everyday Backpack 20L', status: 'owned' },
]
