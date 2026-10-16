// A kit shared as a link. The link says what each item is, and never whose it is: no serial
// numbers, and nothing about buying, keeping, or insuring it. Prices and notes go in only when
// chosen. The kit travels after the # of the address, so no server sees it, and opening a link is
// treated like opening a backup file: its size is capped and everything in it is checked.
import { z } from 'zod'
import { gearShape } from './backup/schema'
import type { IsoDate } from './dates'
import { toGearInput, validateGear, type Gear, type GearFields } from './gear'
import { kitGear, validateKit, type Kit, type KitDetails } from './kits'
import { LOCALE } from './locale'
import { err, ok, type Result } from './result'
import { cleanLine } from './text'

export const SHARE_APP = 'bodycap-kit'
export const SHARE_FORMAT = 1
/** The longest link Bodycap makes or opens, in characters after #/shared/. About 50 items. */
export const SHARE_LIMIT = 16_000

export interface ShareChoices {
  /** Each item's purchase price */
  readonly prices: boolean
  /** The kit's description and each item's notes */
  readonly notes: boolean
}

/** A kit opened from a link, with each item as it would go on the wishlist */
export interface SharedKit extends KitDetails {
  readonly items: readonly GearFields[]
}

// What a link may say about an item. Listing the fields one by one means a field added to gear
// later stays out of links unless it's added here on purpose.
const itemSchema = z.object(gearShape).pick({
  category: true,
  brand: true,
  model: true,
  mount: true,
  sensorFormat: true,
  lensCoverage: true,
  focalLengthMin: true,
  focalLengthMax: true,
  maxAperture: true,
  maxApertureTele: true,
  filterThread: true,
  weight: true,
  // Names only the model, never the copy, so it can stay linked on the wishlist it goes to
  catalogueId: true,
  adapterFrom: true,
  adapterTo: true,
  adapterAutofocus: true,
  purchasePrice: true,
  notes: true,
})

type ItemFields = z.output<typeof itemSchema>

/** An item as it goes into a link. Fields left out are undefined, and JSON drops them. */
type SharedItem = { readonly [K in keyof ItemFields]-?: ItemFields[K] | undefined }

const fileSchema = z.object({
  app: z.literal(SHARE_APP),
  format: z.literal(SHARE_FORMAT),
  // Far above the kit form's limits, which validateKit applies afterwards
  name: z.string().max(1_000),
  description: z.string().max(50_000).exactOptional(),
  items: z.array(itemSchema).min(1).max(1_000),
})

// Just enough to tell a shared kit from anything else, before knowing which format it's in
const headerSchema = z.looseObject({ app: z.literal(SHARE_APP), format: z.unknown() })

const EMPTY = "There's nothing in this kit to share yet."
const TOO_BIG = 'This kit is too big to share as a link. Leave out notes, or share a smaller kit.'
const TOO_LONG = "This link is longer than any kit Bodycap makes, so it wasn't opened."
const UNREADABLE =
  "This link doesn't hold a whole Bodycap kit. Part of it may have been cut off when it was sent, so ask for it again."
const NEWER =
  'This kit was shared from a newer version of Bodycap. Reload to update, then open the link again.'
const DAMAGED =
  "Something in this link has been changed or broken, so it can't be opened. Ask for it again."

/** What a link says about an item */
function describe(item: Gear, { prices, notes }: ShareChoices): SharedItem {
  const {
    category,
    brand,
    model,
    mount,
    sensorFormat,
    lensCoverage,
    focalLengthMin,
    focalLengthMax,
    maxAperture,
    maxApertureTele,
    filterThread,
    weight,
    catalogueId,
    adapterFrom,
    adapterTo,
    adapterAutofocus,
  } = item
  return {
    category,
    brand,
    model,
    mount,
    sensorFormat,
    lensCoverage,
    focalLengthMin,
    focalLengthMax,
    maxAperture,
    maxApertureTele,
    filterThread,
    weight,
    catalogueId,
    adapterFrom,
    adapterTo,
    adapterAutofocus,
    purchasePrice: prices ? item.purchasePrice : undefined,
    notes: notes ? item.notes : undefined,
  }
}

/** The kit as the part of a link after #/shared/, or why it can't be shared */
export function shareKitLink(
  kit: Kit,
  gear: readonly Gear[],
  choices: ShareChoices,
): Result<string> {
  const items = kitGear(kit, gear).map((item) => describe(item, choices))
  if (items.length === 0) return err(EMPTY)
  const file = {
    app: SHARE_APP,
    format: SHARE_FORMAT,
    name: kit.name,
    description: choices.notes ? kit.description : undefined,
    items,
  }
  const link = toBase64Url(JSON.stringify(file))
  return link.length > SHARE_LIMIT ? err(TOO_BIG) : ok(link)
}

/** A kit from the part of a link after #/shared/, checked as carefully as a backup file */
export function openSharedKit(link: string, today: IsoDate): Result<SharedKit> {
  if (link.length > SHARE_LIMIT) return err(TOO_LONG)
  const text = fromBase64Url(link)
  if (text === undefined) return err(UNREADABLE)
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return err(UNREADABLE)
  }

  const header = headerSchema.safeParse(json)
  if (!header.success) return err(UNREADABLE)
  const { format } = header.data
  if (typeof format === 'number' && Number.isInteger(format) && format > SHARE_FORMAT) {
    return err(NEWER)
  }
  const parsed = fileSchema.safeParse(json)
  if (!parsed.success) return err(DAMAGED)

  // The same rules as the forms, so a changed link can't bring in anything the app wouldn't save
  const { name, description, items } = parsed.data
  const details = validateKit({ name, description: description ?? '' })
  if (!details.ok) return err(DAMAGED)
  const checked: GearFields[] = []
  for (const item of items) {
    const result = validateGear(toGearInput({ ...item, status: 'wishlist' }), today)
    if (!result.ok) return err(DAMAGED)
    checked.push(result.value)
  }
  return ok({ ...details.value, items: checked })
}

const sameText = (text: string) => cleanLine(text).toLocaleLowerCase(LOCALE)

/**
 * Gear here that's the same as a shared item: the same category, brand, and model, whatever the
 * case or spacing. Gear that's been sold or lost doesn't count, as it could be wanted again.
 */
export function matchingGear(
  item: Pick<GearFields, 'category' | 'brand' | 'model'>,
  gear: readonly Gear[],
): Gear | undefined {
  return gear.find(
    (other) =>
      other.status !== 'sold' &&
      other.status !== 'lost' &&
      other.category === item.category &&
      sameText(other.brand) === sameText(item.brand) &&
      sameText(other.model) === sameText(item.model),
  )
}

// Links carry UTF-8 as URL-safe base64 without padding, which needs no escaping after the #

function toBase64Url(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(link: string): string | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(link)) return undefined
  try {
    const binary = atob(link.replaceAll('-', '+').replaceAll('_', '/'))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
}
