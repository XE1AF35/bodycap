// Serial numbers get typed in many ways ("0123-4567", "01234567 "), so they're compared in a
// normalised form. Matches only count within one brand, because short serials repeat across makers.
import { cleanLine } from './text'

/** The parts of a gear item that duplicate checks look at */
export interface SerialItem {
  readonly id: string
  readonly brand: string
  readonly serialNumber?: string
}

export interface DuplicateSerial {
  readonly serialKey: string
  readonly ids: readonly string[]
}

// Hyphens, the Unicode hyphen and dash characters, and any whitespace
const SEPARATORS = /[-\s\u2010-\u2015]/gu

/** Upper case without separators. NFKC also turns full-width letters and digits into plain ones. */
export function normaliseSerial(serial: string): string {
  return serial.normalize('NFKC').replace(SEPARATORS, '').toUpperCase()
}

/** The normalised serial, plus a key shared by items with the same brand and serial */
function serialMatch(
  brand: string,
  serialNumber = '',
): { readonly key: string; readonly serialKey: string } | undefined {
  const serialKey = normaliseSerial(serialNumber)
  if (serialKey === '') return undefined
  return { key: JSON.stringify([cleanLine(brand).toLowerCase(), serialKey]), serialKey }
}

/** Groups of items that share a brand and serial, sorted by serial. Items keep their given order. */
export function findDuplicateSerials(items: Iterable<SerialItem>): DuplicateSerial[] {
  const groups = new Map<string, { serialKey: string; ids: string[] }>()
  for (const { id, brand, serialNumber } of items) {
    const match = serialMatch(brand, serialNumber)
    if (match === undefined) continue
    const group = groups.get(match.key)
    if (group) {
      group.ids.push(id)
    } else {
      groups.set(match.key, { serialKey: match.serialKey, ids: [id] })
    }
  }
  return [...groups.values()]
    .filter((group) => group.ids.length > 1)
    .sort((a, b) => a.serialKey.localeCompare(b.serialKey))
}

/** IDs of other items with the same brand and serial, for a warning while someone edits an item. */
export function findSerialClashes(
  candidate: Omit<SerialItem, 'id'>,
  items: Iterable<SerialItem>,
  excludeId?: string,
): string[] {
  const key = serialMatch(candidate.brand, candidate.serialNumber)?.key
  if (key === undefined) return []
  const clashes: string[] = []
  for (const item of items) {
    if (item.id !== excludeId && serialMatch(item.brand, item.serialNumber)?.key === key) {
      clashes.push(item.id)
    }
  }
  return clashes
}
