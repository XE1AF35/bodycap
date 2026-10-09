// Photos on an item's page and in the gear list: adding them from files, the first becoming the
// cover, viewing one full size and choosing it as the cover or deleting it there, the most an item
// can have, files that can't be used, alt text, cover thumbnails in the list, and the delete dialog
// counting photos.
import { screen, waitFor, within, type BoundFunctions, type queries } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GearFields } from '@/core/gear'
import type { NewPhoto } from '@/core/photos'
import type { Live } from '@/data/repositories'
import { renderApp, stubObjectUrls, testServices } from './support'

afterEach(() => {
  vi.restoreAllMocks()
})

const camera: GearFields = {
  category: 'camera-body',
  brand: 'Canon',
  model: 'EOS R6 Mark II',
  mount: 'canon-rf',
  status: 'owned',
}

/** The first value a live query gives */
function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}

const jpeg = (name: string) => new File(['jpeg'], name, { type: 'image/jpeg' })

const shrunk = (): NewPhoto => ({
  image: new Blob(['image'], { type: 'image/webp' }),
  thumbnail: new Blob(['thumb'], { type: 'image/webp' }),
  mimeType: 'image/webp',
  width: 1600,
  height: 1200,
})

/** The camera's page, with `photos` already added to it */
async function renderItem(photos = 0, { applyAccept = true } = {}) {
  const urls = stubObjectUrls()
  const services = testServices()
  const item = await services.repositories.gear.add(camera)
  if (photos > 0) {
    await services.repositories.photos.add(
      item.id,
      Array.from({ length: photos }, () => shrunk()),
    )
  }
  renderApp(`/gear/${item.id}`, services)
  await screen.findByRole('heading', { level: 1, name: 'Canon EOS R6 Mark II' })
  const section = within(await screen.findByRole('region', { name: 'Photos' }))
  return { services, item, section, urls, user: userEvent.setup({ applyAccept }) }
}

/** Each photo in the gallery, with whether it's marked as the cover */
const gallery = (section: BoundFunctions<typeof queries>) =>
  section.queryAllByRole('listitem').map((photo) => ({
    name: within(photo)
      .getByRole('button', { name: /^View photo/ })
      .getAttribute('aria-label'),
    cover: within(photo).queryByText('Cover') !== null,
  }))

describe('photos on an item', () => {
  it('says when the item has no photos yet', async () => {
    const { section } = await renderItem()
    expect(section.getByText('No photos yet.')).toBeVisible()
  })

  it('adds the photos chosen, the first as the cover, and says so', async () => {
    const { user, section, services, item } = await renderItem()
    await user.upload(section.getByLabelText('Photos to add'), [jpeg('front.jpg'), jpeg('top.jpg')])
    expect(await section.findByText('Added 2 photos.')).toHaveAttribute('role', 'status')
    expect(gallery(section)).toEqual([
      { name: 'View photo 1 of 2', cover: true },
      { name: 'View photo 2 of 2', cover: false },
    ])
    expect(await current(services.repositories.photos.forGear(item.id))).toMatchObject([
      { isCover: true, mimeType: 'image/webp', width: 1600, height: 1200 },
      { isCover: false },
    ])
  })

  it('opens the add button as a file picker that takes several photos', async () => {
    const { section } = await renderItem()
    const input = section.getByLabelText('Photos to add')
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('accept', 'image/*')
    expect(input).toHaveAttribute('multiple')
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined)
    await userEvent.setup().click(section.getByRole('button', { name: 'Add photos' }))
    expect(click).toHaveBeenCalledOnce()
  })

  it('shows each thumbnail, and the photo full size with alt text naming the item', async () => {
    const { user, section } = await renderItem(2)
    // The button says what it does, so the thumbnail inside it is left out of its name
    const view = section.getByRole('button', { name: 'View photo 2 of 2' })
    const thumbnail = view.querySelector('img')
    expect(thumbnail).toHaveAttribute('alt', '')
    expect(thumbnail?.getAttribute('src')).toMatch(/^blob:/)
    await user.click(view)
    const viewer = within(await screen.findByRole('dialog', { name: 'Photo 2 of 2' }))
    const full = viewer.getByRole('img', { name: 'Canon EOS R6 Mark II, photo 2 of 2' })
    expect(full.getAttribute('src')).toMatch(/^blob:/)
    expect(full.getAttribute('src')).not.toBe(thumbnail?.getAttribute('src'))
    await user.click(viewer.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('makes another photo the cover from its full-size view', async () => {
    const { user, section } = await renderItem(2)
    await user.click(section.getByRole('button', { name: 'View photo 1 of 2' }))
    const cover = within(await screen.findByRole('dialog', { name: 'Photo 1 of 2' }))
    expect(cover.getByText("This is the item's cover photo.")).toBeVisible()
    expect(cover.queryByRole('button', { name: 'Make cover' })).toBeNull()
    await user.click(cover.getByRole('button', { name: 'Close' }))

    await user.click(section.getByRole('button', { name: 'View photo 2 of 2' }))
    const other = within(await screen.findByRole('dialog', { name: 'Photo 2 of 2' }))
    await user.click(other.getByRole('button', { name: 'Make cover' }))
    expect(await other.findByText("This is the item's cover photo.")).toBeVisible()
    await user.click(other.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(gallery(section).map(({ cover: isCover }) => isCover)).toEqual([false, true])
    })
  })

  it('deletes a photo after asking, passing the cover on, and lets go of its image', async () => {
    const { user, section, urls } = await renderItem(2)
    const first = section
      .getByRole('button', { name: 'View photo 1 of 2' })
      .querySelector('img')
      ?.getAttribute('src')
    await user.click(section.getByRole('button', { name: 'View photo 1 of 2' }))
    const viewer = within(await screen.findByRole('dialog', { name: 'Photo 1 of 2' }))
    await user.click(viewer.getByRole('button', { name: 'Delete' }))
    expect(viewer.getByRole('alert')).toHaveTextContent(
      'Delete this photo? It goes from Bodycap for good.',
    )
    // The photo stays in view while the person decides
    expect(viewer.getByRole('img', { name: 'Canon EOS R6 Mark II, photo 1 of 2' })).toBeVisible()
    expect(viewer.getByRole('button', { name: 'Keep it' })).toHaveFocus()
    await user.click(viewer.getByRole('button', { name: 'Delete photo' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    await waitFor(() => {
      expect(gallery(section)).toEqual([{ name: 'View photo 1 of 1', cover: true }])
    })
    expect(urls.revoked).toContain(first)
    // The photo's button went with it, so focus goes to the heading
    expect(section.getByRole('heading', { name: 'Photos' })).toHaveFocus()
  })

  it('keeps a photo when the person changes their mind', async () => {
    const { user, section } = await renderItem(1)
    await user.click(section.getByRole('button', { name: 'View photo 1 of 1' }))
    const viewer = within(await screen.findByRole('dialog', { name: 'Photo 1 of 1' }))
    await user.click(viewer.getByRole('button', { name: 'Delete' }))
    await user.click(viewer.getByRole('button', { name: 'Keep it' }))
    expect(viewer.queryByRole('alert')).toBeNull()
    expect(viewer.getByRole('button', { name: 'Delete' })).toBeVisible()
    // The page behind the viewer is hidden from screen readers until it closes
    await user.click(viewer.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(gallery(section)).toHaveLength(1)
    })
  })

  it('adds the photos it can, and says which files it could not use', async () => {
    const { user, section } = await renderItem(0, { applyAccept: false })
    const manual = new File(['%PDF'], 'manual.pdf', { type: 'application/pdf' })
    await user.upload(section.getByLabelText('Photos to add'), [jpeg('front.jpg'), manual])
    expect(await section.findByText('Added 1 photo.')).toHaveAttribute('role', 'status')
    expect(section.getByRole('alert')).toHaveTextContent("manual.pdf isn't a photo.")
    expect(gallery(section)).toHaveLength(1)
  })

  it('turns down more photos than the item has room for, adding none', async () => {
    const { user, section } = await renderItem(11)
    await user.upload(section.getByLabelText('Photos to add'), [jpeg('a.jpg'), jpeg('b.jpg')])
    expect(await section.findByRole('alert')).toHaveTextContent(
      'This item has room for 1 more photo. Choose just one.',
    )
    expect(gallery(section)).toHaveLength(11)
  })

  it('says when the item has all the photos it can have, in place of the add button', async () => {
    const { section } = await renderItem(12)
    expect(section.queryByRole('button', { name: 'Add photos' })).toBeNull()
    expect(
      section.getByText(
        'This item has the most photos it can have (12). Delete one to add another.',
      ),
    ).toBeVisible()
  })
})

describe('cover photos elsewhere', () => {
  it("shows each item's cover beside its name in the gear list", async () => {
    stubObjectUrls()
    const services = testServices()
    const item = await services.repositories.gear.add(camera)
    await services.repositories.gear.add({ ...camera, model: 'EOS R8' })
    await services.repositories.photos.add(item.id, [shrunk()])
    const { container } = renderApp('/gear', services)
    await screen.findAllByRole('link', { name: 'Canon EOS R6 Mark II' })
    // Once in the table and once in the cards, which CSS shows one of. Its name is beside it.
    await waitFor(() => {
      expect(container.querySelectorAll('img')).toHaveLength(2)
    })
    const covers = container.querySelectorAll('img')
    for (const cover of covers) {
      expect(cover).toHaveAttribute('alt', '')
      expect(cover.getAttribute('src')).toMatch(/^blob:/)
    }
  })

  it('says the photos go too when an item is deleted', async () => {
    const { user } = await renderItem(2)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Canon EOS R6 Mark II?' })
    expect(confirm).toHaveTextContent('Its 2 photos go with it.')
  })
})
