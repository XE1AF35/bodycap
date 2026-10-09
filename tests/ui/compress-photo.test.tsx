// Shrinking photos in the browser, with a stand-in for the canvas jsdom doesn't have: the sizes
// drawn, WebP with a JPEG fallback, and plain messages for files that can't be used.
import { describe, expect, it, vi } from 'vitest'
import type { PixelSize } from '@/core/photos'
import { compressPhoto, type Picture } from '@/ui/photos/compress'

/** A photo the browser has decoded, which records the sizes it's drawn at */
function decoded(size: PixelSize, writes: (type: string) => string | undefined = (type) => type) {
  const drawn: PixelSize[] = []
  const picture = (at: PixelSize): Picture => ({
    ...at,
    scaled: (next) => {
      drawn.push(next)
      return picture(next)
    },
    encode: (type) => {
      const written = writes(type)
      const label = `${type} ${String(at.width)}x${String(at.height)}`
      return Promise.resolve(written === undefined ? null : new Blob([label], { type: written }))
    },
  })
  const close = vi.fn()
  return { drawn, close, decode: vi.fn(() => Promise.resolve({ ...picture(size), close })) }
}

const jpeg = (name = 'IMG_0001.JPG', size = 4_000_000) =>
  new File([new Uint8Array(size)], name, { type: 'image/jpeg' })

describe('compressPhoto', () => {
  it('shrinks a photo to 1600 px and its thumbnail to 320 px, as WebP', async () => {
    const browser = decoded({ width: 6000, height: 4000 })
    const result = await compressPhoto(jpeg(), browser.decode)
    expect(result).toEqual({
      ok: true,
      value: {
        image: expect.any(Blob) as unknown,
        thumbnail: expect.any(Blob) as unknown,
        mimeType: 'image/webp',
        width: 1600,
        height: 1067,
      },
    })
    if (!result.ok) return
    expect(await result.value.image.text()).toBe('image/webp 1600x1067')
    expect(await result.value.thumbnail.text()).toBe('image/webp 320x213')
    // The thumbnail is drawn from the shrunk photo, not the full-size one
    expect(browser.drawn).toEqual([
      { width: 1600, height: 1067 },
      { width: 320, height: 213 },
    ])
    expect(browser.close).toHaveBeenCalledOnce()
  })

  it('keeps a small photo at its own size', async () => {
    const browser = decoded({ width: 800, height: 600 })
    expect(await compressPhoto(jpeg(), browser.decode)).toMatchObject({
      ok: true,
      value: { width: 800, height: 600 },
    })
    expect(browser.drawn).toEqual([
      { width: 800, height: 600 },
      { width: 320, height: 240 },
    ])
  })

  it('falls back to JPEG when the browser hands back something else for WebP', async () => {
    const safari = decoded({ width: 3000, height: 4000 }, (type) =>
      type === 'image/webp' ? 'image/png' : type,
    )
    const result = await compressPhoto(jpeg(), safari.decode)
    expect(result).toMatchObject({ ok: true, value: { mimeType: 'image/jpeg', width: 1200 } })
    if (!result.ok) return
    expect([result.value.image.type, result.value.thumbnail.type]).toEqual([
      'image/jpeg',
      'image/jpeg',
    ])
  })

  it('turns down a file that is not a photo without opening it', async () => {
    const browser = decoded({ width: 100, height: 100 })
    const pdf = new File(['%PDF'], 'manual.pdf', { type: 'application/pdf' })
    expect(await compressPhoto(pdf, browser.decode)).toEqual({
      ok: false,
      error: "manual.pdf isn't a photo.",
    })
    expect(browser.decode).not.toHaveBeenCalled()
  })

  it('explains when this browser cannot open the photo', async () => {
    const heic = new File(['ftypheic'], 'IMG_0002.HEIC', { type: '' })
    const decode = vi.fn(() => Promise.reject(new DOMException('No decoder', 'InvalidStateError')))
    expect(await compressPhoto(heic, decode)).toEqual({
      ok: false,
      error: "IMG_0002.HEIC can't be opened in this browser. Try a JPEG or PNG copy of it.",
    })
  })

  it('explains when the browser cannot write the photo out again', async () => {
    const browser = decoded({ width: 4000, height: 3000 }, () => undefined)
    expect(await compressPhoto(jpeg('scan.jpg'), browser.decode)).toEqual({
      ok: false,
      error: "scan.jpg couldn't be shrunk to save. Try another photo.",
    })
    expect(browser.close).toHaveBeenCalledOnce()
  })
})
