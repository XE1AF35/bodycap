// Photo rules: the sizes photos and thumbnails shrink to, which chosen files are worth opening, how
// many photos an item can have, the order they're shown in, and keeping one cover per item.
import { describe, expect, it } from 'vitest'
import {
  coverChanges,
  fitWithin,
  MAX_PHOTOS_PER_ITEM,
  photoCountProblem,
  photoFileProblem,
  photoSizes,
  sortPhotos,
  type CoverPhoto,
  type PhotoFile,
  type PixelSize,
} from '@/core/photos'

describe('fitWithin', () => {
  it.each<[string, PixelSize, number, PixelSize]>([
    ['a landscape photo', { width: 4000, height: 3000 }, 1600, { width: 1600, height: 1200 }],
    ['a portrait photo', { width: 3000, height: 4000 }, 1600, { width: 1200, height: 1600 }],
    [
      'a 3:2 photo, to whole pixels',
      { width: 6000, height: 4000 },
      1600,
      { width: 1600, height: 1067 },
    ],
    ['a photo that fits exactly', { width: 1600, height: 900 }, 1600, { width: 1600, height: 900 }],
    [
      'a small photo, never enlarged',
      { width: 800, height: 600 },
      1600,
      { width: 800, height: 600 },
    ],
    [
      'a thin strip, keeping at least 1 px',
      { width: 20000, height: 10 },
      320,
      { width: 320, height: 1 },
    ],
  ])('fits %s', (_name, size, edge, expected) => {
    expect(fitWithin(size, edge)).toEqual(expected)
  })

  it.each<[PixelSize, number]>([
    [{ width: 0, height: 100 }, 1600],
    [{ width: 100, height: -1 }, 1600],
    [{ width: 100, height: 1.5 }, 1600],
    [{ width: Number.NaN, height: 100 }, 1600],
    [{ width: 100, height: 100 }, 0],
  ])('refuses %o within %i px, which no image can be', (size, edge) => {
    expect(() => fitWithin(size, edge)).toThrow(RangeError)
  })
})

describe('photoSizes', () => {
  it('shrinks a photo to 1600 px and its thumbnail to 320 px on the long side', () => {
    expect(photoSizes({ width: 8192, height: 5464 })).toEqual({
      photo: { width: 1600, height: 1067 },
      thumbnail: { width: 320, height: 213 },
    })
  })
})

describe('photoFileProblem', () => {
  const file = (fields: Partial<PhotoFile>): PhotoFile => ({
    name: 'IMG_0001.JPG',
    type: 'image/jpeg',
    size: 4_000_000,
    ...fields,
  })

  it.each<[string, Partial<PhotoFile>]>([
    ['a JPEG', {}],
    ['a PNG', { name: 'scan.png', type: 'image/png' }],
    ['a HEIC photo, which Windows gives no type', { name: 'IMG_0002.HEIC', type: '' }],
    ['a file of exactly 50 MB', { size: 50_000_000 }],
  ])('lets %s through to be opened', (_name, fields) => {
    expect(photoFileProblem(file(fields))).toBeUndefined()
  })

  it.each<[string, Partial<PhotoFile>, string]>([
    ['a PDF', { name: 'manual.pdf', type: 'application/pdf' }, "manual.pdf isn't a photo."],
    ['an SVG drawing', { name: 'logo.svg', type: 'image/svg+xml' }, "logo.svg isn't a photo."],
    ['an empty file', { name: 'blank.jpg', size: 0 }, 'blank.jpg is empty.'],
    [
      'a file over 50 MB',
      { name: 'huge.tif', type: 'image/tiff', size: 50_000_001 },
      'huge.tif is too big. Photos can be up to 50 MB.',
    ],
  ])('turns down %s', (_name, fields, message) => {
    expect(photoFileProblem(file(fields))).toBe(message)
  })
})

describe('photoCountProblem', () => {
  it.each([
    [0, 1],
    [0, MAX_PHOTOS_PER_ITEM],
    [MAX_PHOTOS_PER_ITEM - 1, 1],
    [MAX_PHOTOS_PER_ITEM, 0],
  ])('lets an item with %i photos take %i more', (existing, adding) => {
    expect(photoCountProblem(existing, adding)).toBeUndefined()
  })

  it.each([
    [12, 1, 'This item has the most photos it can have (12). Delete one to add another.'],
    [13, 1, 'This item has the most photos it can have (12). Delete one to add another.'],
    [10, 3, 'This item has room for 2 more photos. Choose 2 or fewer.'],
    [11, 2, 'This item has room for 1 more photo. Choose just one.'],
  ])('turns down an item with %i photos taking %i more', (existing, adding, message) => {
    expect(photoCountProblem(existing, adding)).toBe(message)
  })
})

/** A photo of item `gearId`, added at minute `minute` */
const photo = (
  id: string,
  { gearId = 'body', minute = 0, isCover = false } = {},
): CoverPhoto & { readonly note: string } => ({
  id,
  gearId,
  isCover,
  createdAt: `2026-10-09T01:${String(minute).padStart(2, '0')}:00.000Z`,
  note: `photo ${id}`,
})

describe('sortPhotos', () => {
  it('puts the oldest first, and photos added at the same moment in ID order', () => {
    const photos = [photo('c', { minute: 2 }), photo('b', { minute: 1 }), photo('a', { minute: 2 })]
    expect(sortPhotos(photos).map(({ id }) => id)).toEqual(['b', 'a', 'c'])
  })

  it('leaves the list it was given as it was', () => {
    const photos = [photo('b', { minute: 1 }), photo('a')]
    sortPhotos(photos)
    expect(photos.map(({ id }) => id)).toEqual(['b', 'a'])
  })
})

describe('coverChanges', () => {
  it('has nothing to change for an item with no photos', () => {
    expect(coverChanges([])).toEqual([])
  })

  it("makes an item's first photo its cover", () => {
    expect(coverChanges([photo('a')])).toEqual([{ ...photo('a'), isCover: true }])
  })

  it('keeps the cover an item has as more photos are added', () => {
    const photos = [photo('a', { isCover: true }), photo('b', { minute: 1 })]
    expect(coverChanges(photos)).toEqual([])
  })

  it('moves the cover to the photo chosen, keeping the rest of each photo', () => {
    const photos = [photo('a', { isCover: true }), photo('b', { minute: 1 })]
    expect(coverChanges(photos, 'b')).toEqual([
      { ...photo('a'), isCover: false },
      { ...photo('b', { minute: 1 }), isCover: true },
    ])
  })

  it.each([
    ['the cover already', 'a'],
    ['not one of these photos', 'gone'],
  ])('changes nothing when the photo chosen is %s', (_name, chosen) => {
    const photos = [photo('a', { isCover: true }), photo('b', { minute: 1 })]
    expect(coverChanges(photos, chosen)).toEqual([])
  })

  it('makes the oldest photo left the cover once the cover is deleted', () => {
    const left = [photo('c', { minute: 3 }), photo('b', { minute: 2 }), photo('a', { minute: 2 })]
    expect(coverChanges(left)).toEqual([{ ...photo('a', { minute: 2 }), isCover: true }])
  })

  it('keeps only the oldest cover when a merge brings two together', () => {
    const photos = [photo('b', { minute: 1, isCover: true }), photo('a', { isCover: true })]
    expect(coverChanges(photos)).toEqual([{ ...photo('b', { minute: 1 }), isCover: false }])
  })

  it('settles each item on its own, and the photo chosen only changes its own item', () => {
    const photos = [
      photo('a', { isCover: true }),
      photo('b', { minute: 1 }),
      photo('c', { gearId: 'lens' }),
      photo('d', { gearId: 'flash', isCover: true }),
    ]
    expect(coverChanges(photos, 'b')).toEqual([
      { ...photo('a'), isCover: false },
      { ...photo('b', { minute: 1 }), isCover: true },
      { ...photo('c', { gearId: 'lens' }), isCover: true },
    ])
  })
})
