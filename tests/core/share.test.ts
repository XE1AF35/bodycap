// Shared kit links: what goes in (never serials or other private details, and prices and notes
// only when chosen), the round trip back out, links that are refused, and spotting gear already had.
import { describe, expect, it } from 'vitest'
import type { Gear } from '@/core/gear'
import type { Kit } from '@/core/kits'
import {
  matchingGear,
  openSharedKit,
  SHARE_APP,
  SHARE_LIMIT,
  shareKitLink,
  type ShareChoices,
} from '@/core/share'

const TODAY = '2026-10-07'
const STAMPS = { createdAt: '2026-03-01T01:00:00.000Z', updatedAt: '2026-03-01T01:00:00.000Z' }

const lens: Gear = {
  ...STAMPS,
  id: '6f1c7a52-3b8e-4f0a-9d2c-5e4b1a7c8d90',
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  nickname: 'Workhorse',
  serialNumber: 'SN-1834567',
  mount: 'sony-e',
  lensCoverage: 'full-frame',
  focalLengthMin: 24,
  focalLengthMax: 70,
  maxAperture: 2.8,
  filterThread: 82,
  weight: 695,
  catalogueId: 'sony-fe-24-70mm-f2-8-gm-ii',
  purchaseDate: '2026-03-01',
  purchasePrice: { amountMinor: 389900, currency: 'NZD' },
  whereBought: 'Photo Warehouse',
  condition: 'excellent',
  status: 'owned',
  currentLocation: 'Studio shelf',
  warrantyExpiry: '2028-03-01',
  insuredValue: { amountMinor: 250000, currency: 'USD' },
  notes: 'Bought with the hood',
}

const body: Gear = {
  ...STAMPS,
  id: '0b7e2d14-8c3a-4e6f-a1d9-2f5c8b3e7a60',
  category: 'camera-body',
  brand: 'Sony',
  model: 'A7 IV',
  serialNumber: 'SN-7654321',
  mount: 'sony-e',
  sensorFormat: 'full-frame',
  weight: 658,
  catalogueId: 'sony-a7-iv',
  status: 'sold',
  saleDate: '2026-09-01',
  salePrice: { amountMinor: 250000, currency: 'NZD' },
}

const adapter: Gear = {
  ...STAMPS,
  id: '9d4a6c21-5e7b-4f80-b3c2-1a8e6d5f4b37',
  category: 'mount-adapter',
  brand: 'Sigma',
  model: 'MC-11',
  adapterFrom: 'canon-ef',
  adapterTo: 'sony-e',
  adapterAutofocus: true,
  status: 'lent-out',
}

const kit: Kit = {
  ...STAMPS,
  id: '3c5e7a90-1b2d-4f6e-8a0c-9e7d5b3a1f24',
  name: 'Wedding kit',
  description: 'Two bodies, one bag',
  // The adapter first, as kits keep the order gear was added in, and an item since deleted
  gearIds: [adapter.id, lens.id, 'a1b2c3d4-0000-4000-8000-000000000000', body.id],
  checklist: true,
  packedGearIds: [lens.id],
}

const GEAR = [lens, body, adapter]
const NOTHING: ShareChoices = { prices: false, notes: false }
const EVERYTHING: ShareChoices = { prices: true, notes: true }

/** A link made from the kit, opened again */
function roundTrip(choices: ShareChoices, from: Kit = kit) {
  const link = shareKitLink(from, GEAR, choices)
  if (!link.ok) throw new Error(link.error)
  return openSharedKit(link.value, TODAY)
}

/** Bytes as the URL-safe base64 links use */
const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')

/** The JSON inside a link, as anyone who has the link could read it */
function inside(choices: ShareChoices): string {
  const link = shareKitLink(kit, GEAR, choices)
  if (!link.ok) throw new Error(link.error)
  const binary = atob(link.value.replaceAll('-', '+').replaceAll('_', '/'))
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

/** A link holding whatever JSON is given, as a changed or hand-made link would */
const linkOf = (value: unknown) =>
  base64Url(new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)))

const validFile = {
  app: SHARE_APP,
  format: 1,
  name: 'Street kit',
  items: [{ category: 'camera-body', brand: 'Fujifilm', model: 'X100VI' }],
}

const UNREADABLE =
  "This link doesn't hold a whole Bodycap kit. Part of it may have been cut off when it was sent, so ask for it again."
const NEWER =
  'This kit was shared from a newer version of Bodycap. Reload to update, then open the link again.'
const DAMAGED =
  "Something in this link has been changed or broken, so it can't be opened. Ask for it again."

describe('shareKitLink and openSharedKit', () => {
  it('bring back what each item is, in the kit, in its order, ready for the wishlist', () => {
    expect(roundTrip(NOTHING)).toEqual({
      ok: true,
      value: {
        name: 'Wedding kit',
        items: [
          {
            category: 'mount-adapter',
            brand: 'Sigma',
            model: 'MC-11',
            adapterFrom: 'canon-ef',
            adapterTo: 'sony-e',
            adapterAutofocus: true,
            status: 'wishlist',
          },
          {
            category: 'lens',
            brand: 'Sony',
            model: 'FE 24-70mm F2.8 GM II',
            mount: 'sony-e',
            lensCoverage: 'full-frame',
            focalLengthMin: 24,
            focalLengthMax: 70,
            maxAperture: 2.8,
            filterThread: 82,
            weight: 695,
            catalogueId: 'sony-fe-24-70mm-f2-8-gm-ii',
            status: 'wishlist',
          },
          {
            category: 'camera-body',
            brand: 'Sony',
            model: 'A7 IV',
            mount: 'sony-e',
            sensorFormat: 'full-frame',
            weight: 658,
            catalogueId: 'sony-a7-iv',
            status: 'wishlist',
          },
        ],
      },
    })
  })

  it.each<[string, ShareChoices, Record<string, unknown>, Record<string, unknown>]>([
    ['nothing extra', NOTHING, {}, {}],
    ['prices', { prices: true, notes: false }, {}, { purchasePrice: lens.purchasePrice }],
    [
      'notes, with the kit description',
      { prices: false, notes: true },
      { description: 'Two bodies, one bag' },
      { notes: 'Bought with the hood' },
    ],
  ])('share %s when chosen', (_name, choices, kitExtras, lensExtras) => {
    const opened = roundTrip(choices)
    if (!opened.ok) throw new Error(opened.error)
    const { items, ...details } = opened.value
    expect(details).toEqual({ name: 'Wedding kit', ...kitExtras })
    expect(items[1]).toEqual({
      category: 'lens',
      brand: 'Sony',
      model: 'FE 24-70mm F2.8 GM II',
      mount: 'sony-e',
      lensCoverage: 'full-frame',
      focalLengthMin: 24,
      focalLengthMax: 70,
      maxAperture: 2.8,
      filterThread: 82,
      weight: 695,
      catalogueId: 'sony-fe-24-70mm-f2-8-gm-ii',
      status: 'wishlist',
      ...lensExtras,
    })
  })

  it.each([
    ['serial numbers', 'SN-1834567'],
    ['serial numbers of sold gear', 'SN-7654321'],
    ['the field names of private details', 'serialNumber'],
    ['nicknames', 'Workhorse'],
    ['where gear was bought', 'Photo Warehouse'],
    ['where gear is kept', 'Studio shelf'],
    ['purchase dates', '2026-03-01'],
    ['warranty dates', '2028-03-01'],
    ['insured values', '250000'],
    ['sale details', '2026-09-01'],
    ['condition', 'excellent'],
    ['status', 'lent-out'],
    ["the kit's IDs", lens.id],
    ['what has been packed', 'packed'],
  ])('never put %s in a link, whatever is chosen', (_name, secret) => {
    expect(inside(EVERYTHING)).not.toContain(secret)
    expect(inside(NOTHING)).not.toContain(secret)
  })

  it('keep text in any language', () => {
    const shared: Kit = { ...kit, name: 'R\u0101kau kit \u{1F4F7}', gearIds: [lens.id] }
    const opened = roundTrip(NOTHING, shared)
    expect(opened.ok && opened.value.name).toBe('R\u0101kau kit \u{1F4F7}')
  })

  it.each<[string, Kit, string]>([
    [
      'has nothing in it',
      { ...kit, gearIds: ['a1b2c3d4-0000-4000-8000-000000000000'], packedGearIds: [] },
      "There's nothing in this kit to share yet.",
    ],
    [
      'is too big for a link',
      { ...kit, gearIds: Array.from({ length: 200 }, () => lens.id), packedGearIds: [] },
      'This kit is too big to share as a link. Leave out notes, or share a smaller kit.',
    ],
  ])('say so when the kit %s', (_name, from, message) => {
    expect(shareKitLink(from, GEAR, EVERYTHING)).toEqual({ ok: false, error: message })
  })

  it('make links that are safe after the # of an address', () => {
    const link = shareKitLink(kit, GEAR, EVERYTHING)
    expect(link.ok && link.value).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('openSharedKit', () => {
  it('opens a link made elsewhere, applying the gear rules', () => {
    expect(openSharedKit(linkOf(validFile), TODAY)).toEqual({
      ok: true,
      value: {
        name: 'Street kit',
        items: [
          { category: 'camera-body', brand: 'Fujifilm', model: 'X100VI', status: 'wishlist' },
        ],
      },
    })
  })

  // Links made before format 4 have none of these, and still open as they are
  it('opens weight, filter thread, and catalogue ID from a link that has them', () => {
    const measured = {
      ...validFile,
      items: [
        { ...validFile.items[0], weight: 521, catalogueId: 'fujifilm-x100vi' },
        { category: 'filter', brand: 'B+W', model: 'UV 77mm', filterThread: 77 },
      ],
    }
    const opened = openSharedKit(linkOf(measured), TODAY)
    expect(opened.ok && opened.value.items).toEqual([
      {
        category: 'camera-body',
        brand: 'Fujifilm',
        model: 'X100VI',
        weight: 521,
        catalogueId: 'fujifilm-x100vi',
        status: 'wishlist',
      },
      { category: 'filter', brand: 'B+W', model: 'UV 77mm', filterThread: 77, status: 'wishlist' },
    ])
  })

  it('drops anything a link holds that a shared kit never does', () => {
    const opened = openSharedKit(
      linkOf({
        ...validFile,
        items: [{ ...validFile.items[0], serialNumber: 'SN-1', currentLocation: 'Home' }],
      }),
      TODAY,
    )
    expect(opened.ok && opened.value.items[0]).toEqual({
      category: 'camera-body',
      brand: 'Fujifilm',
      model: 'X100VI',
      status: 'wishlist',
    })
  })

  const cutOff = (() => {
    const link = shareKitLink(kit, GEAR, NOTHING)
    return link.ok ? link.value.slice(0, -12) : ''
  })()

  it.each<[string, string, string]>([
    ['an empty link', '', UNREADABLE],
    ['a link cut off on the way', cutOff, UNREADABLE],
    ['text that is not a link Bodycap made', 'not a link!', UNREADABLE],
    ['a link that is not JSON', linkOf('hello'), UNREADABLE],
    ['bytes that are not text', base64Url(new Uint8Array([0xff, 0xfe, 0xfd])), UNREADABLE],
    ['a backup rather than a kit', linkOf({ app: 'bodycap', formatVersion: 2 }), UNREADABLE],
    ['a kit from a newer version', linkOf({ ...validFile, format: 2 }), NEWER],
    ['a format that is not a number', linkOf({ ...validFile, format: 'one' }), DAMAGED],
    ['a kit with no gear', linkOf({ ...validFile, items: [] }), DAMAGED],
    ['a kit with no name', linkOf({ ...validFile, name: '  ' }), DAMAGED],
    [
      'an unknown mount',
      linkOf({ ...validFile, items: [{ ...validFile.items[0], mount: 'leica-x' }] }),
      DAMAGED,
    ],
    [
      'optics that break the rules',
      linkOf({
        ...validFile,
        items: [
          {
            category: 'lens',
            brand: 'Sony',
            model: 'FE 70-200mm',
            focalLengthMin: 200,
            focalLengthMax: 70,
          },
        ],
      }),
      DAMAGED,
    ],
    [
      'a weight the form would refuse',
      linkOf({ ...validFile, items: [{ ...validFile.items[0], weight: 0 }] }),
      DAMAGED,
    ],
    [
      'a filter thread that is text',
      linkOf({ ...validFile, items: [{ ...validFile.items[0], filterThread: '77mm' }] }),
      DAMAGED,
    ],
    [
      'a model name longer than the form allows',
      linkOf({ ...validFile, items: [{ ...validFile.items[0], model: 'X'.repeat(121) }] }),
      DAMAGED,
    ],
    [
      'a link longer than any Bodycap makes',
      'A'.repeat(SHARE_LIMIT + 1),
      "This link is longer than any kit Bodycap makes, so it wasn't opened.",
    ],
  ])('refuses %s', (_name, link, message) => {
    expect(openSharedKit(link, TODAY)).toEqual({ ok: false, error: message })
  })
})

describe('matchingGear', () => {
  const shared = {
    category: 'lens',
    brand: ' sony ',
    model: 'fe 24-70MM F2.8 gm ii',
    status: 'wishlist',
  } as const

  it.each<[string, readonly Gear[], string | undefined]>([
    ['the same item, whatever the case or spacing', [body, lens], lens.id],
    ['the same item on the wishlist', [{ ...lens, status: 'wishlist' }], lens.id],
    ['nothing for gear that has gone', [{ ...lens, status: 'sold' }], undefined],
    ['nothing for another category', [{ ...lens, category: 'other' }], undefined],
    ['nothing for another model', [{ ...lens, model: 'FE 24-70mm F2.8 GM' }], undefined],
  ])('finds %s', (_name, gear, expected) => {
    expect(matchingGear(shared, gear)?.id).toBe(expected)
  })
})
