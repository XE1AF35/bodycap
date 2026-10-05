// Money helpers: currency codes, parsing typed amounts into minor units, en-NZ formatting, and totals.
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CURRENCY,
  formatMoney,
  isCurrencyCode,
  minorUnitDigits,
  parseAmount,
  sumByCurrency,
  toAmountInput,
  type Money,
} from '@/core/money'

const nzd = (amountMinor: number): Money => ({ amountMinor, currency: 'NZD' })

describe('isCurrencyCode', () => {
  it.each([
    ['NZD', true],
    ['USD', true],
    ['JPY', true],
    ['nzd', false],
    ['XYZ', false],
    ['NZDD', false],
    ['', false],
  ])('treats %j as valid: %s', (code, valid) => {
    expect(isCurrencyCode(code)).toBe(valid)
  })

  it('uses NZD as the default currency', () => {
    expect(DEFAULT_CURRENCY).toBe('NZD')
  })
})

describe('minorUnitDigits', () => {
  it.each([
    ['NZD', 2],
    ['USD', 2],
    ['JPY', 0],
    ['KWD', 3],
  ])('gives %s %i decimal places', (currency, digits) => {
    expect(minorUnitDigits(currency)).toBe(digits)
  })

  it('refuses a currency code that does not exist', () => {
    expect(() => minorUnitDigits('XYZ')).toThrow(RangeError)
  })
})

describe('parseAmount', () => {
  it.each([
    ['1299', 'NZD', 129900],
    ['1,299.50', 'NZD', 129950],
    ['  $1,299.5  ', 'NZD', 129950],
    ['0', 'NZD', 0],
    ['.5', 'NZD', 50],
    ['12.', 'NZD', 1200],
    ['12.500', 'NZD', 1250],
    ['12,345,678.90', 'NZD', 1234567890],
    ['1,235', 'JPY', 1235],
    ['1.234', 'KWD', 1234],
  ])('reads %j in %s as %i minor units', (text, currency, amountMinor) => {
    expect(parseAmount(text, currency)).toEqual({ ok: true, value: amountMinor })
  })

  it.each([
    ['', 'NZD', 'Enter an amount.'],
    ['   ', 'NZD', 'Enter an amount.'],
    ['-5', 'NZD', "Amounts can't be negative."],
    ['$-5', 'NZD', "Amounts can't be negative."],
    ['abc', 'NZD', 'Enter the amount in numbers, for example 1,299.50.'],
    ['1,29', 'NZD', 'Enter the amount in numbers, for example 1,299.50.'],
    ['1.2.3', 'NZD', 'Enter the amount in numbers, for example 1,299.50.'],
    ['$', 'NZD', 'Enter the amount in numbers, for example 1,299.50.'],
    ['1e5', 'NZD', 'Enter the amount in numbers, for example 1,299.50.'],
    ['abc', 'JPY', 'Enter the amount in numbers, for example 1,299.'],
    ['12.345', 'NZD', 'NZD amounts can have at most 2 decimal places.'],
    ['1.5', 'JPY', "JPY amounts don't have decimal places."],
    ['99999999999999999', 'NZD', 'That amount is too large.'],
  ])('rejects %j in %s with %j', (text, currency, message) => {
    expect(parseAmount(text, currency)).toEqual({ ok: false, error: message })
  })

  it('refuses a currency code that does not exist', () => {
    expect(() => parseAmount('10', 'XYZ')).toThrow(RangeError)
  })
})

describe('formatMoney', () => {
  it.each([
    [nzd(123450), '$1,234.50'],
    [nzd(0), '$0.00'],
    [{ amountMinor: 123450, currency: 'USD' }, 'US$1,234.50'],
    [{ amountMinor: 9900, currency: 'AUD' }, 'A$99.00'],
    [{ amountMinor: 1235, currency: 'JPY' }, 'JP¥1,235'],
  ])('formats %j as %s', (money, text) => {
    expect(formatMoney(money)).toBe(text)
  })
})

describe('toAmountInput', () => {
  it.each([
    [nzd(129950), '1299.50'],
    [nzd(5), '0.05'],
    [nzd(0), '0.00'],
    [{ amountMinor: 1235, currency: 'JPY' }, '1235'],
    [{ amountMinor: 1234, currency: 'KWD' }, '1.234'],
  ])('writes %j as %s for an input field', (money, text) => {
    expect(toAmountInput(money)).toBe(text)
  })

  it.each([nzd(0), nzd(5), nzd(129950), { amountMinor: 1235, currency: 'JPY' }])(
    'reads back %j unchanged through parseAmount',
    (money) => {
      expect(parseAmount(toAmountInput(money), money.currency)).toEqual({
        ok: true,
        value: money.amountMinor,
      })
    },
  )

  it.each([-1, 1.5])('refuses %d minor units, which no stored amount can be', (amountMinor) => {
    expect(() => toAmountInput(nzd(amountMinor))).toThrow(RangeError)
  })
})

describe('sumByCurrency', () => {
  it('adds amounts in the same currency', () => {
    expect(sumByCurrency([nzd(100), nzd(250)])).toEqual([nzd(350)])
  })

  it('keeps currencies apart, with NZD first and the rest in alphabetical order', () => {
    const amounts: Money[] = [
      { amountMinor: 500, currency: 'USD' },
      nzd(100),
      { amountMinor: 300, currency: 'AUD' },
      { amountMinor: 200, currency: 'USD' },
    ]
    expect(sumByCurrency(amounts)).toEqual([
      nzd(100),
      { amountMinor: 300, currency: 'AUD' },
      { amountMinor: 700, currency: 'USD' },
    ])
  })

  it('can put a different currency first', () => {
    const amounts: Money[] = [nzd(100), { amountMinor: 300, currency: 'USD' }]
    expect(sumByCurrency(amounts, 'USD').map((money) => money.currency)).toEqual(['USD', 'NZD'])
  })

  it('returns no totals when there are no amounts', () => {
    expect(sumByCurrency([])).toEqual([])
  })
})
