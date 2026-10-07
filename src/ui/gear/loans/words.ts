// Small bits of wording about loans, shared by the item page and the dashboard.
import { LOCALE } from '@/core/locale'

const count = new Intl.NumberFormat(LOCALE)

/** Such as "1 day overdue" or "6 days overdue" */
export function overdueText(days: number): string {
  return `${count.format(days)} ${days === 1 ? 'day' : 'days'} overdue`
}
