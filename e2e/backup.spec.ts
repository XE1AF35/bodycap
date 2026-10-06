// Backing up, then restoring into a browser with nothing in it, and getting exactly the same gear.
import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { expect, open, SAMPLE_GEAR, seedGear, test, watchForProblems } from './fixtures'

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

test('restores a backup into an empty browser, exactly as it was @storage', async ({
  page,
  browser,
}, testInfo) => {
  await seedGear(page, SAMPLE_GEAR)
  const first = await backUp(page, testInfo.outputPath('backup.json'))
  expect(first.name).toMatch(/^bodycap-backup-\d{4}-\d{2}-\d{2}\.json$/)

  // A new browser context has its own, empty storage: as if the data had been wiped
  const context = await browser.newContext()
  const fresh = await context.newPage()
  const problems = watchForProblems(fresh)
  await open(fresh, '#/settings')
  const restore = fresh.getByRole('region', { name: 'Restore' })
  await restore.getByLabel('Backup file').setInputFiles(testInfo.outputPath('backup.json'))
  await expect(restore.getByText(/holds 3 items/)).toBeVisible()
  await restore.getByRole('button', { name: 'Restore this backup' }).click()
  const dialog = fresh.getByRole('alertdialog', { name: 'Replace everything?' })
  await dialog.getByRole('button', { name: 'Replace everything' }).click()
  await expect(fresh.getByText(/^Restored 3 items/)).toBeVisible()

  await open(fresh, '#/gear')
  await expect(fresh.getByRole('table').getByRole('link')).toHaveText([
    'Fujifilm X-T5',
    'Peak Design Everyday Backpack 20L',
    'Sony FE 24-70mm F2.8 GM II',
  ])

  // A backup of the restored data holds exactly what the first one did
  const second = await backUp(fresh, testInfo.outputPath('backup-again.json'))
  expect(second.data).toEqual(first.data)
  expect(problems).toEqual([])
  await context.close()
})
