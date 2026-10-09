// Small bits of wording the settings sections share.
import type { BackupList } from '@/core/backup/format'
import { LOCALE } from '@/core/locale'

const numbers = new Intl.NumberFormat(LOCALE)
const lists = new Intl.ListFormat(LOCALE, { type: 'conjunction' })

const counted = (count: number, one: string, many: string) =>
  `${numbers.format(count)} ${count === 1 ? one : many}`

/** Such as "1 item" or "40 items" */
export function itemCount(count: number): string {
  return counted(count, 'item', 'items')
}

/** Such as "2 items", or "2 items and 5 photos" once there are photos */
export function gearAndPhotos(items: number, photos: number): string {
  return photos === 0
    ? itemCount(items)
    : `${itemCount(items)} and ${counted(photos, 'photo', 'photos')}`
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
]

/** Such as "2 items and 1 kit", leaving out kinds there are none of, or undefined if there are none */
export function recordCounts(counts: Readonly<Record<BackupList, number>>): string | undefined {
  const parts = KINDS.filter(([kind]) => counts[kind] > 0).map(([kind, one, many]) =>
    counted(counts[kind], one, many),
  )
  return parts.length === 0 ? undefined : lists.format(parts)
}

export const relativeDays = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
