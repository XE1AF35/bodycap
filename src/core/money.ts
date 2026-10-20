// Money is a whole number of the currency's smallest unit plus an ISO 4217 code, so totals never
// pick up floating-point rounding errors and each amount keeps its own currency.
import { LOCALE } from './locale'
import { err, ok, type Result } from './result'

/** An ISO 4217 code such as NZD. Check codes from outside the app with isCurrencyCode. */
export type CurrencyCode = string

export interface Money {
  /** Whole minor units: cents for NZD, yen for JPY, and fils for KWD */
  readonly amountMinor: number
  readonly currency: CurrencyCode
}

export const DEFAULT_CURRENCY: CurrencyCode = 'NZD'

const supportedCurrencies = new Set(Intl.supportedValuesOf('currency'))

export function isCurrencyCode(value: string): boolean {
  return supportedCurrencies.has(value)
}

const digitsByCurrency = new Map<CurrencyCode, number>()

/** How many decimal places a currency uses, such as 2 for NZD, 0 for JPY, and 3 for KWD. */
export function minorUnitDigits(currency: CurrencyCode): number {
  let digits = digitsByCurrency.get(currency)
  if (digits === undefined) {
    // Intl would happily format a made-up code with 2 decimals, so unknown codes are refused first
    if (!isCurrencyCode(currency)) {
      throw new RangeError(`Unknown currency code: ${currency}`)
    }
    // A currency with no fraction part in its format, like JPY, has no minor unit digits
    const parts = new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).formatToParts(1)
    digits = parts.find((part) => part.type === 'fraction')?.value.length ?? 0
    digitsByCurrency.set(currency, digits)
  }
  return digits
}

// Plain digits, or digits grouped in threes with commas, then an optional decimal part
const AMOUNT = /^(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d*))?$/

/**
 * Reads an amount someone typed, such as "1,299.50" or "$80", into minor units. Amounts are
 * never negative, and extra decimal places are refused rather than silently rounded.
 */
export function parseAmount(text: string, currency: CurrencyCode): Result<number> {
  const digits = minorUnitDigits(currency)
  const trimmed = text.trim()
  if (trimmed === '') {
    return err('Enter an amount.')
  }

  // People often type a leading dollar sign out of habit, so it's allowed and ignored
  const number = trimmed.replace(/^\$\s*/, '')
  if (number.startsWith('-')) {
    return err("Amounts can't be negative.")
  }

  const match = AMOUNT.exec(number)
  if (!match || !/\d/.test(number)) {
    const example = digits === 0 ? '1,299' : `1,299.${'50'.padEnd(digits, '0')}`
    return err(`Enter the amount in numbers, for example ${example}.`)
  }

  // Trailing zeros past the currency's decimals change nothing, so "12.500" is fine for NZD
  const fraction = (match[2] ?? '').replace(/0+$/, '')
  if (fraction.length > digits) {
    return err(
      digits === 0
        ? `${currency} amounts don't have decimal places.`
        : `${currency} amounts can have at most ${String(digits)} decimal places.`,
    )
  }

  const whole = (match[1] ?? '').replaceAll(',', '')
  // Built as text and converted once, so no floating-point maths touches the amount
  const amountMinor = Number(whole + fraction.padEnd(digits, '0'))
  if (!Number.isSafeInteger(amountMinor)) {
    return err('That amount is too large.')
  }
  return ok(amountMinor)
}

const formatters = new Map<CurrencyCode, Intl.NumberFormat>()

/** Shows an amount the en-NZ way, such as $1,234.50 for NZD and US$1,234.50 for USD. */
export function formatMoney({ amountMinor, currency }: Money): string {
  let formatter = formatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency })
    formatters.set(currency, formatter)
  }
  return formatter.format(amountMinor / 10 ** minorUnitDigits(currency))
}

/** Writes an amount as plain text for an input field, such as 1299.50, which parseAmount reads back. */
export function toAmountInput({ amountMinor, currency }: Money): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError(`Not a stored amount: ${String(amountMinor)}`)
  }
  const digits = minorUnitDigits(currency)
  if (digits === 0) {
    return String(amountMinor)
  }
  const padded = String(amountMinor).padStart(digits + 1, '0')
  return `${padded.slice(0, -digits)}.${padded.slice(-digits)}`
}

/**
 * Adds up amounts per currency, without converting between them. The `first` currency (NZD by
 * default) leads, and the rest follow in alphabetical order.
 */
export function sumByCurrency(
  amounts: Iterable<Money>,
  first: CurrencyCode = DEFAULT_CURRENCY,
): Money[] {
  const totals = new Map<CurrencyCode, number>()
  for (const { amountMinor, currency } of amounts) {
    totals.set(currency, (totals.get(currency) ?? 0) + amountMinor)
  }
  const order = currencyOrder(first)
  return [...totals]
    .map(([currency, amountMinor]) => ({ amountMinor, currency }))
    .sort((a, b) => order(a.currency, b.currency))
}

/** Sorts currencies with `first` leading and the rest in alphabetical order */
export function currencyOrder(
  first: CurrencyCode = DEFAULT_CURRENCY,
): (a: CurrencyCode, b: CurrencyCode) => number {
  const rank = (currency: CurrencyCode) => (currency === first ? 0 : 1)
  return (a, b) => rank(a) - rank(b) || a.localeCompare(b)
}
