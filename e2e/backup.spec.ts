// Backing up, then restoring into a browser with nothing in it and getting exactly the same gear,
// kits, loans, and maintenance, or merging into a browser that has gear of its own.
import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { expect, open, SAMPLE_COLLECTION, seed, seedGear, test, watchForProblems } from './fixtures'

/** Backs up from Settings, returning the saved file's path and contents */
async function backUp(page: Page, path: string): Promise<{ name: string; data: unknown }> {
  await open(page, '#/settings')
  const backup = page.getByRole('region', { name: 'Backup' })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    backup.getByRole('button', { name: 'Back up now' }).click(),
  ])
  await download.saveAs(path)
  await expect(backup.getByRole('status')).toHaveText(
    `Backup saved as ${download.suggestedFilename()}.`,
  )
  const file = JSON.parse(await readFile(path, 'utf8')) as { data: unknown }
  return { name: download.suggestedFilename(), data: file.data }
}

/** The names in the gear table, in code point order so the check doesn't depend on collation */
async function gearNames(page: Page): Promise<string[]> {
  await open(page, '#/gear')
  const links = page.getByRole('table').getByRole('link')
  await expect(links.first()).toBeVisible()
  return (await links.allTextContents()).sort()
}

const COLLECTION_NAMES = [
  'Fujifilm X-T5',
  'Fujifilm XF 33mm F1.4 R LM WR',
  'Peak Design Everyday Backpack 20L',
  'Sony FE 24-70mm F2.8 GM II',
]

test('restores a backup into an empty browser, exactly as it was @storage', async ({
  page,
  browser,
}, testInfo) => {
  await seed(page, SAMPLE_COLLECTION)
  const first = await backUp(page, testInfo.outputPath('backup.json'))
  expect(first.name).toMatch(/^bodycap-backup-\d{4}-\d{2}-\d{2}\.json$/)

  // A new browser context has its own, empty storage: as if the data had been wiped
  const context = await browser.newContext()
  const fresh = await context.newPage()
  const problems = watchForProblems(fresh)
  await open(fresh, '#/settings')
  const restore = fresh.getByRole('region', { name: 'Restore' })
  await restore.getByLabel('Backup file').setInputFiles(testInfo.outputPath('backup.json'))
  await expect(restore.getByText(/holds 4 items/)).toBeVisible()
  await restore.getByRole('button', { name: 'Restore this backup' }).click()
  const dialog = fresh.getByRole('alertdialog', { name: 'Replace everything?' })
  await dialog.getByRole('button', { name: 'Replace everything' }).click()
  await expect(fresh.getByText(/^Restored 4 items/)).toBeVisible()

  expect(await gearNames(fresh)).toEqual(COLLECTION_NAMES)
  await open(fresh, '#/kits')
  await expect(fresh.getByRole('link', { name: 'Wedding kit' })).toBeVisible()

  // A backup of the restored data holds exactly what the first one did
  const second = await backUp(fresh, testInfo.outputPath('backup-again.json'))
  expect(second.data).toEqual(first.data)
  expect(problems).toEqual([])
  await context.close()
})

test('merges a backup into a browser with gear of its own @storage', async ({
  page,
  browser,
}, testInfo) => {
  await seed(page, SAMPLE_COLLECTION)
  await backUp(page, testInfo.outputPath('backup.json'))

  const context = await browser.newContext()
  const other = await context.newPage()
  const problems = watchForProblems(other)
  await seedGear(other, [{ category: 'flash', brand: 'Godox', model: 'V1', status: 'owned' }])
  await open(other, '#/settings')
  const restore = other.getByRole('region', { name: 'Restore' })
  await restore.getByLabel('Backup file').setInputFiles(testInfo.outputPath('backup.json'))
  await restore.getByRole('radio', { name: "Add to what's here" }).check()
  await restore.getByRole('button', { name: 'Restore this backup' }).click()
  const dialog = other.getByRole('alertdialog', { name: 'Merge this backup?' })
  await dialog.getByRole('button', { name: 'Merge', exact: true }).click()
  // The list of kinds may or may not have a comma before "and", depending on the browser
  await expect(restore.getByRole('status')).toHaveText(
    /^Merged the backup made on .+\. Added 4 items, 1 kit, 1 loan,? and 1 maintenance record\.$/,
  )

  expect(await gearNames(other)).toEqual([...COLLECTION_NAMES, 'Godox V1'].sort())
  expect(problems).toEqual([])
  await context.close()
})
