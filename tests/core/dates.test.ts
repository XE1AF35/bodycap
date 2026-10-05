// Calendar date helpers: checking YYYY-MM-DD strings, today in a time zone, day maths, and display.
import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, formatDate, isIsoDate, toIsoDate } from '@/core/dates'

describe('isIsoDate', () => {
  it.each(['2026-10-05', '2024-02-29', '1960-01-01', '0999-12-31'])('accepts %s', (text) => {
    expect(isIsoDate(text)).toBe(true)
  })

  it.each([
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-10-32',
    '2026-04-31',
    '2026-1-5',
    '05/10/2026',
    '2026-10-05T00:00',
    ' 2026-10-05',
    '',
  ])('rejects %j', (text) => {
    expect(isIsoDate(text)).toBe(false)
  })
})

describe('toIsoDate', () => {
  it.each([
    ['2026-10-04T12:30:00Z', 'Pacific/Auckland', '2026-10-05'],
    ['2026-10-04T12:30:00Z', 'UTC', '2026-10-04'],
    ['2026-10-04T12:30:00Z', 'America/Los_Angeles', '2026-10-04'],
    ['2026-12-31T11:30:00Z', 'Pacific/Auckland', '2027-01-01'],
  ])('turns %s into the calendar date in %s (%s)', (instant, timeZone, date) => {
    expect(toIsoDate(new Date(instant), timeZone)).toBe(date)
  })
})

describe('daysBetween', () => {
  it.each([
    ['2026-10-05', '2026-10-05', 0],
    ['2026-10-05', '2026-10-06', 1],
    ['2026-10-06', '2026-10-05', -1],
    // NZ daylight saving starts on 27 September 2026, which must not shorten the count
    ['2026-09-26', '2026-09-28', 2],
    ['2024-02-28', '2024-03-01', 2],
    ['2026-01-01', '2027-01-01', 365],
  ])('counts from %s to %s as %i days', (from, to, days) => {
    expect(daysBetween(from, to)).toBe(days)
  })

  it('refuses a date that does not exist', () => {
    expect(() => daysBetween('2026-02-30', '2026-03-01')).toThrow(RangeError)
  })
})

describe('addDays', () => {
  it.each([
    ['2026-10-05', 30, '2026-11-04'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2024-02-28', 1, '2024-02-29'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-10-05', 0, '2026-10-05'],
  ])('moves %s by %i days to %s', (date, days, result) => {
    expect(addDays(date, days)).toBe(result)
  })

  it('refuses part days', () => {
    expect(() => addDays('2026-10-05', 1.5)).toThrow(RangeError)
  })

  it('refuses a date that does not exist', () => {
    expect(() => addDays('2026-13-01', 1)).toThrow(RangeError)
  })
})

describe('formatDate', () => {
  it.each([
    ['2026-10-05', '5 Oct 2026'],
    ['2026-01-31', '31 Jan 2026'],
    // en-NZ shortens September to Sept
    ['2026-09-09', '9 Sept 2026'],
  ])('shows %s as %s', (date, text) => {
    expect(formatDate(date)).toBe(text)
  })
})
