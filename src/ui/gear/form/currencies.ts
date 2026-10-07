// The currency choices for an amount: the ones Bodycap's users are most likely to pay in, then
// every currency the browser knows, each with its name.
import { LOCALE } from '@/core/locale'
import { DEFAULT_CURRENCY, type CurrencyCode } from '@/core/money'
import type { Settings } from '@/data/repositories'

const COMMON = ['NZD', 'AUD', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'CHF', 'CNY', 'HKD', 'SGD']

const names = new Intl.DisplayNames(LOCALE, { type: 'currency' })

export const CURRENCY_GROUPS = [
  { label: 'Common', codes: COMMON },
  {
    label: 'All currencies',
    codes: Intl.supportedValuesOf('currency').filter((code) => !COMMON.includes(code)),
  },
] as const

/** Such as "NZD, New Zealand dollar" */
export function currencyName(code: string): string {
  return `${code}, ${names.of(code) ?? code}`
}

/** The currency new amounts start in. Without settings, such as when they can't be read, NZD. */
export function startingCurrency(settings: Settings | undefined): CurrencyCode {
  return settings?.defaultCurrency ?? settings?.lastUsedCurrency ?? DEFAULT_CURRENCY
}
