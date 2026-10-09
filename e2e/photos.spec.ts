// Photos, the CSV export, and the insurance list in a real browser: a photo is shrunk and stored
// without its location, a .zip backup brings every photo back exactly in an empty browser, the CSV
// opens in a spreadsheet safely, and the insurance list prints on white paper.
import { readFile } from 'node:fs/promises'
import type { Locator, Page } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'
import {
  addPhotos,
  expect,
  open,
  photoFile,
  SAMPLE_COLLECTION,
  SAMPLE_GEAR,
  seed,
  seedGear,
  test,
  watchForProblems,
  withLocation,
} from './fixtures'

/** What's stored for each photo, read straight from IndexedDB */
async function storedPhotos(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bodycap')
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB would not open'))
      }
    })
    const all = <T>(table: string) =>
      new Promise<T[]>((resolve, reject) => {
        const request = db.transaction(table).objectStore(table).getAll()
        request.onsuccess = () => {
          resolve(request.result as T[])
        }
        request.onerror = () => {
          reject(request.error ?? new Error(`The ${table} would not load`))
        }
      })
    const records = await all<{
      id: string
      mimeType: string
      width: number
      height: number
      isCover: boolean
      thumbnail: ArrayBuffer
    }>('photos')
    const images = await all<{ id: string; image: ArrayBuffer }>('photoImages')
    db.close()
    // Latin-1 maps each byte to one character, so any EXIF marker shows up as text
    const exif = (bytes: ArrayBuffer | undefined) =>
      /exif/i.test(new TextDecoder('latin1').decode(bytes))
    return records.map(({ id, mimeType, width, height, isCover, thumbnail }) => {
      const image = images.find((stored) => stored.id === id)?.image
      return { mimeType, width, height, isCover, exif: exif(image) || exif(thumbnail) }
    })
  })
}

/** Whether an image has loaded and been decoded, which a CSP block or a bad file would stop */
async function shows(image: Locator): Promise<number> {
  await expect(image).toBeVisible()
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.complete))
    .toBe(true)
  return image.evaluate((element: HTMLImageElement) => element.naturalWidth)
}

async function openItem(page: Page, name: string) {
  await open(page, '#/gear')
  await page.getByRole('table').getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test('shrinks a photo and leaves its location behind @storage', async ({ page }) => {
  await seedGear(page, SAMPLE_GEAR)
  await openItem(page, 'Fujifilm X-T5')
  const photo = withLocation(await photoFile(page))
  expect(photo.buffer.includes('Exif')).toBe(true)
  await addPhotos(page, [photo])

  const [stored] = await storedPhotos(page)
  expect(stored).toMatchObject({ width: 1600, height: 1067, isCover: true, exif: false })
  expect(['image/webp', 'image/jpeg']).toContain(stored?.mimeType)

  const photos = page.getByRole('region', { name: 'Photos' })
  const view = photos.getByRole('button', { name: 'View photo 1 of 1' })
  expect(await shows(view.locator('img'))).toBe(320)
  await view.click()
  const viewer = page.getByRole('dialog', { name: 'Photo 1 of 1' })
  expect(await shows(viewer.getByRole('img', { name: 'Fujifilm X-T5, photo 1 of 1' }))).toBe(1600)
})

test('restores every photo from a .zip backup into an empty browser, exactly @storage', async ({
  page,
  browser,
}, testInfo) => {
  await seed(page, SAMPLE_COLLECTION)
  await openItem(page, 'Fujifilm X-T5')
  await addPhotos(page, [await photoFile(page, 'front.jpg'), await photoFile(page, 'top.jpg')])

  const backUp = async (from: Page, path: string) => {
    await open(from, '#/settings')
    const backup = from.getByRole('region', { name: 'Backup' })
    const [download] = await Promise.all([
      from.waitForEvent('download'),
      backup.getByRole('button', { name: 'Back up now' }).click(),
    ])
    await download.saveAs(path)
    expect(download.suggestedFilename()).toMatch(/^bodycap-backup-\d{4}-\d{2}-\d{2}\.zip$/)
    return unzipSync(new Uint8Array(await readFile(path)))
  }
  const first = await backUp(page, testInfo.outputPath('backup.zip'))
  expect(Object.keys(first)).toHaveLength(5)

  // A new browser context has its own, empty storage, as if the data had been wiped
  const context = await browser.newContext()
  const fresh = await context.newPage()
  const problems = watchForProblems(fresh)
  await open(fresh, '#/settings')
  const restore = fresh.getByRole('region', { name: 'Restore' })
  await restore.getByLabel('Backup file').setInputFiles(testInfo.outputPath('backup.zip'))
  await expect(restore.getByText(/holds 4 items and 2 photos/)).toBeVisible()
  await restore.getByRole('button', { name: 'Restore this backup' }).click()
  const dialog = fresh.getByRole('alertdialog', { name: 'Replace everything?' })
  await dialog.getByRole('button', { name: 'Replace everything' }).click()
  await expect(fresh.getByText(/^Restored 4 items and 2 photos/)).toBeVisible()

  await openItem(fresh, 'Fujifilm X-T5')
  const photos = fresh.getByRole('region', { name: 'Photos' })
  for (const name of ['View photo 1 of 2', 'View photo 2 of 2']) {
    expect(await shows(photos.getByRole('button', { name }).locator('img'))).toBe(320)
  }

  // A backup of the restored browser holds exactly what the first one did, photo for photo
  const second = await backUp(fresh, testInfo.outputPath('backup-again.zip'))
  const data = (files: typeof first) => {
    const { data: contents } = JSON.parse(strFromU8(files['data.json'] ?? new Uint8Array())) as {
      data: unknown
    }
    return contents
  }
  const photoFiles = (files: typeof first) =>
    Object.entries(files).filter(([name]) => name !== 'data.json')
  expect(data(second)).toEqual(data(first))
  expect(photoFiles(second)).toEqual(photoFiles(first))
  expect(problems).toEqual([])
  await context.close()
})

test('downloads gear as a CSV that a spreadsheet opens safely', async ({ page }, testInfo) => {
  await seedGear(page, [
    ...SAMPLE_GEAR,
    { category: 'flash', brand: 'Godox', model: 'V1', nickname: '=1+1', status: 'owned' },
  ])
  await open(page, '#/settings')
  const exports = page.getByRole('region', { name: 'Spreadsheet and insurance' })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exports.getByRole('button', { name: 'Download gear as CSV' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^bodycap-gear-\d{4}-\d{2}-\d{2}\.csv$/)
  const path = testInfo.outputPath('gear.csv')
  await download.saveAs(path)
  const bytes = await readFile(path)
  // The byte order mark, so Excel reads it as UTF-8
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const lines = bytes.subarray(3).toString('utf8').split('\r\n')
  expect(lines[0]).toMatch(/^"Category","Brand","Model","Nickname",/)
  expect(lines.filter((line) => line !== '')).toHaveLength(5)
  // The nickname would run as a formula, so it starts with an apostrophe
  expect(lines.find((line) => line.includes('Godox'))).toContain(`"'=1+1"`)
})

test('prints the insurance list on white paper, without the page around it', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bodycap:theme', 'dark')
  })
  await seed(page, SAMPLE_COLLECTION)
  await open(page, '#/insurance')
  await expect(page.getByRole('heading', { level: 1, name: 'Insurance list' })).toBeVisible()
  const colourScheme = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
  expect(await colourScheme()).toBe('dark')
  await expect(page.getByRole('banner')).toBeVisible()

  await page.emulateMedia({ media: 'print' })
  expect(await colourScheme()).toBe('light')
  await expect(page.getByRole('banner')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Print' })).toBeHidden()
  const table = page.getByRole('table', { name: 'Insurance list' })
  await expect(table.getByRole('row')).toHaveCount(5)
  await expect(page.getByText(/^Made with Bodycap on /)).toBeVisible()
})
