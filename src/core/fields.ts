// Reading form fields as typed: tidied text, real dates, and amounts of money. Each gives nothing
// for a blank field, or a message saying what to fix, in the same words the gear form uses.
import { isIsoDate, type IsoDate } from './dates'
import { LOCALE } from './locale'
import { isCurrencyCode, parseAmount, type Money } from './money'
import { err, ok, type Result } from './result'
import { characterCount, cleanLine, cleanMultiline } from './text'

const count = new Intl.NumberFormat(LOCALE)

export interface TextRule {
  /** The most characters allowed, counted as people see them */
  readonly max: number
  /** How messages refer to the field, such as "the notes" */
  readonly name: string
  /** Keeps line breaks, as notes do */
  readonly multiline?: boolean
}

export function readText(text: string, rule: TextRule): Result<string | undefined> {
  const value = rule.multiline === true ? cleanMultiline(text) : cleanLine(text)
  if (value === '') return ok(undefined)
  if (characterCount(value) > rule.max) {
    return err(`Keep ${rule.name} to ${count.format(rule.max)} characters or fewer.`)
  }
  return ok(value)
}

export function readDate(text: string): Result<IsoDate | undefined> {
  const value = text.trim()
  if (value === '') return ok(undefined)
  return isIsoDate(value) ? ok(value) : err('Enter a real date.')
}

/** An amount and its currency, as picked. A blank amount is nothing, whatever the currency. */
export function readMoney(input: {
  readonly amount: string
  readonly currency: string
}): Result<Money | undefined> {
  if (input.amount.trim() === '') return ok(undefined)
  const { currency } = input
  if (!isCurrencyCode(currency)) return err('Choose a currency.')
  const amount = parseAmount(input.amount, currency)
  return amount.ok ? ok({ amountMinor: amount.value, currency }) : err(amount.error)
}

/** Gathers each field's message, so a form reports every problem at once rather than one by one */
export function fieldErrors<F extends string>() {
  const errors: Partial<Record<F, string>> = {}
  /** The value read, or nothing after noting the message against the field */
  const take = <T>(field: F, result: Result<T>): T | undefined => {
    if (result.ok) return result.value
    errors[field] = result.error
    return undefined
  }
  return { errors, take }
}
