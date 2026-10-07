// Reading form fields as typed: tidied text within a length limit, real dates, and amounts of money,
// and gathering every field's message so a form reports them all at once.
import { describe, expect, it } from 'vitest'
import { fieldErrors, readDate, readMoney, readText, type TextRule } from '@/core/fields'
import { parseAmount } from '@/core/money'
import { err, ok } from '@/core/result'

const NAME: TextRule = { max: 5, name: 'the name' }

describe('readText', () => {
  it.each<[string, string, TextRule, string | undefined]>([
    ['nothing for a blank field', '   ', NAME, undefined],
    ['text with its spaces tidied', '  Jo   Ng ', { max: 20, name: 'the name' }, 'Jo Ng'],
    [
      'line breaks kept where the field allows them',
      'Back by\r\nFriday',
      { max: 20, name: 'the notes', multiline: true },
      'Back by\nFriday',
    ],
    [
      'line breaks as spaces where it does not',
      'Back by\nFriday',
      { max: 20, name: 'the name' },
      'Back by Friday',
    ],
    ['text right at the limit', 'abcde', NAME, 'abcde'],
    [
      'characters as people see them, so an emoji counts once',
      '\u{1F44D}'.repeat(5),
      NAME,
      '\u{1F44D}'.repeat(5),
    ],
  ])('reads %s', (_name, typed, rule, expected) => {
    expect(readText(typed, rule)).toEqual(ok(expected))
  })

  it('turns down text over the limit, naming the field and the limit', () => {
    expect(readText('abcdef', NAME)).toEqual(err('Keep the name to 5 characters or fewer.'))
    expect(readText('a'.repeat(5001), { max: 5000, name: 'the notes' })).toEqual(
      err('Keep the notes to 5,000 characters or fewer.'),
    )
  })
})

describe('readDate', () => {
  it.each<[string, string | undefined]>([
    ['', undefined],
    ['  ', undefined],
    ['2026-10-07', '2026-10-07'],
    [' 2026-10-07 ', '2026-10-07'],
  ])('reads %o as %o', (typed, expected) => {
    expect(readDate(typed)).toEqual(ok(expected))
  })

  it.each(['2026-02-30', '7/10/2026', 'tomorrow'])('turns down %o', (typed) => {
    expect(readDate(typed)).toEqual(err('Enter a real date.'))
  })
})

describe('readMoney', () => {
  it.each<[string, { amount: string; currency: string }, unknown]>([
    ['nothing for a blank amount', { amount: ' ', currency: 'NZD' }, undefined],
    ['nothing for a blank amount, whatever the currency', { amount: '', currency: '' }, undefined],
    [
      'an amount in minor units',
      { amount: '1,299.50', currency: 'NZD' },
      { amountMinor: 129950, currency: 'NZD' },
    ],
    [
      'a currency with no minor units',
      { amount: '1500', currency: 'JPY' },
      { amountMinor: 1500, currency: 'JPY' },
    ],
  ])('reads %s', (_name, typed, expected) => {
    expect(readMoney(typed)).toEqual(ok(expected))
  })

  it('asks for a currency it knows', () => {
    expect(readMoney({ amount: '10', currency: 'NOPE' })).toEqual(err('Choose a currency.'))
  })

  it('gives the same message as the amount reader for an amount it cannot read', () => {
    const expected = parseAmount('ten dollars', 'NZD')
    expect(expected.ok).toBe(false)
    expect(readMoney({ amount: 'ten dollars', currency: 'NZD' })).toEqual(expected)
  })
})

describe('fieldErrors', () => {
  it('passes values through, and notes each message against its field', () => {
    const { errors, take } = fieldErrors<'name' | 'date'>()
    expect(take('name', ok('Jo'))).toBe('Jo')
    expect(take<string>('date', err('Enter a real date.'))).toBeUndefined()
    expect(errors).toEqual({ date: 'Enter a real date.' })
  })
})
