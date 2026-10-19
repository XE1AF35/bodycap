// Small bits of wording the settings sections share.
import type { BackupList } from '@/core/backup/format'
import { LOCALE } from '@/core/locale'

const numbers = new Intl.NumberFormat(LOCALE)

const counted = (count: number, one: string, many: string) =>
  `${numbers.format(count)} ${count === 1 ? one : many}`

/** Such as "a and b" or "a, b, and c". By hand, as Intl's en-NZ lists leave out the Oxford comma. */
function andList(parts: readonly string[]): string {
  const last = parts.at(-1) ?? ''
  if (parts.length < 2) return last
  const rest = parts.slice(0, -1)
  return parts.length === 2 ? `${rest.join('')} and ${last}` : `${rest.join(', ')}, and ${last}`
}

/** Such as "1 item" or "40 items" */
export function itemCount(count: number): string {
  return counted(count, 'item', 'items')
}

/**
 * Such as "2 items", "1 shoot", or "2 items, 1 shoot, and 5 photos", leaving out whatever there's
 * none of, and saying "0 items" when there's nothing at all
 */
export function gearShootsAndPhotos(items: number, shoots: number, photos: number): string {
  const parts = [
    ...(items > 0 ? [itemCount(items)] : []),
    ...(shoots > 0 ? [shootCount(shoots)] : []),
    ...(photos > 0 ? [photoCount(photos)] : []),
  ]
  return parts.length === 0 ? itemCount(0) : andList(parts)
}

/** Such as "1 shoot" or "12 shoots" */
export function shootCount(count: number): string {
  return counted(count, 'shoot', 'shoots')
}

/** Such as "1 photo" or "5 photos" */
export function photoCount(count: number): string {
  return counted(count, 'photo', 'photos')
}

const KINDS: readonly (readonly [BackupList, string, string])[] = [
  ['gear', 'item', 'items'],
  ['kits', 'kit', 'kits'],
  ['loans', 'loan', 'loans'],
  ['maintenance', 'maintenance record', 'maintenance records'],
  ['photos', 'photo', 'photos'],
  ['shoots', 'shoot', 'shoots'],
]

/** Such as "2 items and 1 kit", leaving out kinds there are none of, or undefined if there are none */
export function recordCounts(counts: Readonly<Record<BackupList, number>>): string | undefined {
  const parts = KINDS.filter(([kind]) => counts[kind] > 0).map(([kind, one, many]) =>
    counted(counts[kind], one, many),
  )
  return parts.length === 0 ? undefined : andList(parts)
}

export const relativeDays = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
