// Calendar dates are YYYY-MM-DD strings with no time or time zone, so a purchase date can't drift
// when the clocks change, and valid ones sort correctly as plain strings.
import { LOCALE } from './locale'

/** A calendar date such as 2026-10-05. Check dates from outside the app with isIsoDate. */
export type IsoDate = string

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

function toIsoText(date: Date): IsoDate {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

/** Milliseconds at UTC midnight on the date, or undefined if it isn't a real date. */
function utcMidnight(text: string): number | undefined {
  const match = ISO_DATE.exec(text)
  if (!match) {
    return undefined
  }
  const date = new Date(0)
  // setUTCFullYear, unlike Date.UTC, doesn't turn years below 100 into 19xx
  date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  // Out-of-range parts roll over (30 February becomes 2 March), so only a real date reads back the same
  return toIsoText(date) === text ? date.getTime() : undefined
}

function requireUtcMidnight(date: IsoDate): number {
  const time = utcMidnight(date)
  if (time === undefined) {
    throw new RangeError(`Not a real date: ${date}`)
  }
  return time
}

export function isIsoDate(text: string): boolean {
  return utcMidnight(text) !== undefined
}

/**
 * The calendar date at `instant` in a time zone, such as "today" for the person using the app.
 * The caller passes the instant in, so this never reads the clock itself.
 */
export function toIsoDate(instant: Date, timeZone?: string): IsoDate {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes): string => {
    const found = parts.find((candidate) => candidate.type === type)
    if (!found) {
      throw new RangeError(`Intl gave no ${type} for ${instant.toISOString()}`)
    }
    return found.value
  }
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** Whole days from one date to another, negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return (requireUtcMidnight(to) - requireUtcMidnight(from)) / MS_PER_DAY
}

export function addDays(date: IsoDate, days: number): IsoDate {
  if (!Number.isInteger(days)) {
    throw new RangeError(`Days must be a whole number, not ${String(days)}`)
  }
  return toIsoText(new Date(requireUtcMidnight(date) + days * MS_PER_DAY))
}

// UTC matches how dates are stored, so the shown day never shifts with the viewer's time zone
const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Shows a date the en-NZ way, such as 5 Oct 2026. */
export function formatDate(date: IsoDate): string {
  return dateFormatter.format(requireUtcMidnight(date))
}
