// Searching, filtering, and sorting the gear list. It all runs in memory, which is quick enough for
// the few thousand items one person might own.
import { CATEGORY_LABELS, STATUS_LABELS, type Category, type Gear, type Status } from './gear'
import { LOCALE } from './locale'
import type { MountId } from './mounts'
import { normaliseSerial } from './serials'

export type SearchItem = Pick<
  Gear,
  | 'category'
  | 'status'
  | 'brand'
  | 'model'
  | 'nickname'
  | 'serialNumber'
  | 'notes'
  | 'currentLocation'
  | 'whereBought'
  | 'mount'
  | 'adapterFrom'
  | 'adapterTo'
  | 'purchaseDate'
  | 'updatedAt'
>

export const SORT_KEYS = ['name', 'category', 'status', 'purchaseDate', 'updatedAt'] as const

export type SortKey = (typeof SORT_KEYS)[number]

/** What the list is showing. Anything left out doesn't narrow the list. */
export interface GearQuery {
  readonly text?: string | undefined
  readonly category?: Category | undefined
  readonly status?: Status | undefined
  readonly mount?: MountId | undefined
  /** Name by default */
  readonly sort?: SortKey | undefined
  readonly descending?: boolean | undefined
}

/**
 * Lower case with accents removed, so searches ignore both. NFKD also turns full-width and other
 * compatibility forms into plain letters and digits.
 */
function fold(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
}

/** A test for whether an item contains every word typed, in any of its text fields */
function textMatcher(text: string): (item: SearchItem) => boolean {
  const terms = fold(text)
    .split(/\s+/u)
    .filter((word) => word !== '')
    .map((word) => ({ word, serial: normaliseSerial(word) }))
  if (terms.length === 0) return () => true
  return (item) => {
    const fields = [
      item.brand,
      item.model,
      item.nickname,
      item.serialNumber,
      item.notes,
      item.currentLocation,
      item.whereBought,
    ]
    // Joined with line breaks, which no word contains, so a word can't run across two fields
    const haystack = fold(fields.filter((field) => field !== undefined).join('\n'))
    // A serial typed with different spaces or hyphens still matches
    const serialKey = normaliseSerial(item.serialNumber ?? '')
    return terms.every(
      ({ word, serial }) =>
        haystack.includes(word) || (serial !== '' && serialKey.includes(serial)),
    )
  }
}

// Numeric collation puts EOS R5 before EOS R10. Base sensitivity ignores case and accents.
const collator = new Intl.Collator(LOCALE, { numeric: true, sensitivity: 'base' })

function compareNames(a: SearchItem, b: SearchItem): number {
  return (
    collator.compare(a.brand, b.brand) ||
    collator.compare(a.model, b.model) ||
    collator.compare(a.nickname ?? '', b.nickname ?? '')
  )
}

interface SortField {
  readonly value: (item: SearchItem) => string | undefined
  readonly compare: (a: string, b: string) => number
}

const compareLabels = (a: string, b: string) => collator.compare(a, b)
// Calendar dates and UTC timestamps sort correctly as plain strings
const compareCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const SORT_FIELDS: Record<Exclude<SortKey, 'name'>, SortField> = {
  category: { value: (item) => CATEGORY_LABELS[item.category], compare: compareLabels },
  status: { value: (item) => STATUS_LABELS[item.status], compare: compareLabels },
  purchaseDate: { value: (item) => item.purchaseDate, compare: compareCodeUnits },
  updatedAt: { value: (item) => item.updatedAt, compare: compareCodeUnits },
}

function comparator(sort: SortKey, descending: boolean): (a: SearchItem, b: SearchItem) => number {
  const direction = descending ? -1 : 1
  if (sort === 'name') return (a, b) => direction * compareNames(a, b)
  const { value, compare } = SORT_FIELDS[sort]
  return (a, b) => {
    const x = value(a)
    const y = value(b)
    if (x === undefined || y === undefined) {
      // Items with nothing to sort by go last whichever way the list runs, rather than jumping to
      // the top when it's reversed
      if (x !== y) return x === undefined ? 1 : -1
      return compareNames(a, b)
    }
    return direction * compare(x, y) || compareNames(a, b)
  }
}

/**
 * The items that match the query, sorted. Items that sort the same keep the order they came in,
 * and the list passed in is left as it was.
 */
export function filterAndSortGear<T extends SearchItem>(
  items: Iterable<T>,
  { text = '', category, status, mount, sort = 'name', descending = false }: GearQuery,
): T[] {
  const matchesText = textMatcher(text)
  return [...items]
    .filter(
      (item) =>
        (category === undefined || item.category === category) &&
        (status === undefined || item.status === status) &&
        // Adapters count under either of their mounts, so a Nikon Z filter shows the FTZ too
        (mount === undefined ||
          item.mount === mount ||
          item.adapterFrom === mount ||
          item.adapterTo === mount) &&
        matchesText(item),
    )
    .sort(comparator(sort, descending))
}
