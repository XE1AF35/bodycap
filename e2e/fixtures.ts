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

/** Records for each table. Each gets an ID and timestamps unless it brings its own. */
export interface Seed {
  readonly gear: readonly SeedItem[]
  readonly kits?: readonly Record<string, unknown>[]
  readonly loans?: readonly Record<string, unknown>[]
  readonly maintenance?: readonly Record<string, unknown>[]
}

/**
 * Saves records straight into the app's database, then reloads so the app reads them. Faster than
 * typing each one in, for tests about something else.
 */
export async function seed(page: Page, tables: Seed): Promise<void> {
  // The app opens the database first, so it's at the current version with every table
  await open(page)
  const now = new Date().toISOString()
  const stamp = (rows: readonly object[] = []) =>
    rows.map((row) => ({ id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...row }))
  const records = {
    gear: stamp(tables.gear),
    kits: stamp(tables.kits),
    loans: stamp(tables.loans),
    maintenance: stamp(tables.maintenance),
  }
  await page.evaluate(async (byTable) => {
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
      const transaction = db.transaction(Object.keys(byTable), 'readwrite')
      for (const [table, rows] of Object.entries(byTable)) {
        for (const row of rows) transaction.objectStore(table).put(row)
      }
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error ?? new Error('The records were not saved'))
      }
    })
    db.close()
  }, records)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

export function seedGear(page: Page, items: readonly SeedItem[]): Promise<void> {
  return seed(page, { gear: items })
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

/** A local calendar date some days from today, as the app stores dates */
export function daysFromToday(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('en-CA')
}

const X_T5 = '6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90'
const XF_33 = '0b7e2d14-8c3a-4e6f-a1d9-2f5c8b3e7a60'
const BACKPACK = '9d4a6c21-5e7b-4f80-b3c2-1a8e6d5f4b37'

/**
 * Gear with everything M2 added: the X-T5 out on an overdue loan, with a sensor clean logged, and
 * a wedding kit used as a packing checklist, with the X-T5 packed. The X-T5's serial, purchase
 * dates, and warranty give the stats something to show, and sharing something to leave out.
 */
export const SAMPLE_COLLECTION: Seed = {
  gear: [
    {
      id: X_T5,
      category: 'camera-body',
      brand: 'Fujifilm',
      model: 'X-T5',
      serialNumber: 'XT5-0042',
      mount: 'fujifilm-x',
      sensorFormat: 'aps-c',
      purchaseDate: daysFromToday(-400),
      purchasePrice: { amountMinor: 299900, currency: 'NZD' },
      warrantyExpiry: daysFromToday(330),
      status: 'lent-out',
    },
    {
      id: XF_33,
      category: 'lens',
      brand: 'Fujifilm',
      model: 'XF 33mm F1.4 R LM WR',
      mount: 'fujifilm-x',
      lensCoverage: 'aps-c',
      focalLengthMin: 33,
      focalLengthMax: 33,
      maxAperture: 1.4,
      purchaseDate: daysFromToday(-100),
      status: 'owned',
    },
    {
      category: 'lens',
      brand: 'Sony',
      model: 'FE 24-70mm F2.8 GM II',
      mount: 'sony-e',
      status: 'owned',
    },
    {
      id: BACKPACK,
      category: 'bag',
      brand: 'Peak Design',
      model: 'Everyday Backpack 20L',
      status: 'owned',
    },
  ],
  kits: [
    {
      name: 'Wedding kit',
      description: 'For the long days',
      gearIds: [X_T5, XF_33, BACKPACK],
      checklist: true,
      packedGearIds: [X_T5],
    },
  ],
  loans: [
    {
      gearId: X_T5,
      borrower: 'Aroha',
      contact: '021 555 0199',
      dateOut: daysFromToday(-20),
      dueDate: daysFromToday(-3),
    },
  ],
  maintenance: [
    {
      gearId: X_T5,
      type: 'sensor-clean',
      date: daysFromToday(-60),
      cost: { amountMinor: 8900, currency: 'NZD' },
      provider: 'Camera Clinic',
    },
  ],
}

const nikon = (fields: {
  readonly category: string
  readonly model: string
  readonly [field: string]: unknown
}): SeedItem => ({
  brand: 'Nikon',
  status: 'owned',
  ...fields,
})

/**
 * Two Nikon bodies, full frame and APS-C, with lenses for both: a DX lens, an F-mount lens through
 * an FTZ, a gap before the telephoto, and a lens no camera here can take
 */
export const SAMPLE_SYSTEM: Seed = {
  gear: [
    nikon({
      category: 'camera-body',
      model: 'Z6 III',
      mount: 'nikon-z',
      sensorFormat: 'full-frame',
    }),
    nikon({ category: 'camera-body', model: 'Z50 II', mount: 'nikon-z', sensorFormat: 'aps-c' }),
    nikon({
      category: 'lens',
      model: 'Z 24-70mm f/4 S',
      mount: 'nikon-z',
      lensCoverage: 'full-frame',
      focalLengthMin: 24,
      focalLengthMax: 70,
      maxAperture: 4,
    }),
    nikon({
      category: 'lens',
      model: 'Z DX 16-50mm',
      mount: 'nikon-z',
      lensCoverage: 'aps-c',
      focalLengthMin: 16,
      focalLengthMax: 50,
    }),
    nikon({
      category: 'lens',
      model: 'AF-S 50mm f/1.8G',
      mount: 'nikon-f',
      focalLengthMin: 50,
      focalLengthMax: 50,
      maxAperture: 1.8,
    }),
    nikon({
      category: 'lens',
      model: 'Z 180-600mm',
      mount: 'nikon-z',
      focalLengthMin: 180,
      focalLengthMax: 600,
    }),
    nikon({
      category: 'mount-adapter',
      model: 'FTZ II',
      adapterFrom: 'nikon-f',
      adapterTo: 'nikon-z',
      adapterAutofocus: true,
    }),
    { category: 'lens', brand: 'Canon', model: 'RF 50mm F1.8', mount: 'canon-rf', status: 'owned' },
  ],
}

/** Opens the sample collection's wedding kit and its share dialog */
export async function openShareDialog(page: Page): Promise<Locator> {
  await open(page, '#/kits')
  await page.getByRole('link', { name: 'Wedding kit' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Wedding kit' })).toBeVisible()
  await page.getByRole('button', { name: 'Share' }).click()
  const dialog = page.getByRole('dialog', { name: 'Share Wedding kit' })
  await expect(dialog).toBeVisible()
  return dialog
}
