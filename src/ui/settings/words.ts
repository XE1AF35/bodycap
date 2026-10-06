// Small bits of wording the settings sections share.
import { LOCALE } from '@/core/locale'

const counts = new Intl.NumberFormat(LOCALE)

/** Such as "1 item" or "40 items" */
export function itemCount(count: number): string {
  return `${counts.format(count)} ${count === 1 ? 'item' : 'items'}`
}

export const relativeDays = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
