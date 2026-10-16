// The shoots log: each occasion someone went out photographing, on one date, with the items they
// took. Usage is worked out from it, so a shoot only ever points at items that exist.
import type { IsoDate } from './dates'
import { fieldErrors, readDate, readText } from './fields'
import { err, ok, type Result } from './result'

export interface ShootFields {
  /** The day of the shoot, or its first day for a trip of several days */
  readonly date: IsoDate
  readonly name: string
  /** The items taken, in the order they were added */
  readonly gearIds: readonly string[]
  readonly notes?: string
}

export interface Shoot extends ShootFields {
  readonly id: string
  /** ISO 8601 UTC timestamps */
  readonly createdAt: string
  readonly updatedAt: string
}

/** What the shoot form holds, as typed or picked */
export interface ShootInput {
  readonly date: string
  readonly name: string
  readonly gearIds: readonly string[]
  readonly notes: string
}

export type ShootErrors = Partial<Record<keyof ShootInput, string>>

/** A blank form for a shoot today */
export function emptyShootInput(today: IsoDate): ShootInput {
  return { date: today, name: '', gearIds: [], notes: '' }
}

/** Fills the form from a saved shoot */
export function toShootInput(shoot: ShootFields): ShootInput {
  return { date: shoot.date, name: shoot.name, gearIds: shoot.gearIds, notes: shoot.notes ?? '' }
}

/** Checks a shoot as typed. All problems are reported together. An item picked twice goes in once. */
export function validateShoot(input: ShootInput, today: IsoDate): Result<ShootFields, ShootErrors> {
  const { errors, take } = fieldErrors<keyof ShootInput>()

  // Valid dates compare correctly as plain YYYY-MM-DD strings
  const date = take('date', readDate(input.date))
  if (date === undefined) errors.date ??= 'Enter the date of the shoot.'
  else if (date > today) errors.date = "The date can't be in the future."

  const name = take('name', readText(input.name, { max: 80, name: 'the name' }))
  if (name === undefined) errors.name ??= 'Enter a name for the shoot.'

  const notes = take(
    'notes',
    readText(input.notes, { max: 2000, name: 'the notes', multiline: true }),
  )

  if (date === undefined || name === undefined || Object.keys(errors).length > 0) {
    return err(errors)
  }
  return ok({
    date,
    name,
    gearIds: [...new Set(input.gearIds)],
    ...(notes !== undefined ? { notes } : {}),
  })
}

/** Takes an item off a shoot */
export function removeFromShoot<T extends ShootFields>(shoot: T, gearId: string): T {
  return { ...shoot, gearIds: shoot.gearIds.filter((id) => id !== gearId) }
}

/** Shoots by date, newest first. Of shoots on the same day, the one logged last comes first. */
export function newestFirst<T extends Shoot>(shoots: readonly T[]): T[] {
  const key = (shoot: T) => `${shoot.date} ${shoot.createdAt}`
  // Dates and ISO timestamps sort correctly as plain strings
  return [...shoots].sort((a, b) => (key(a) === key(b) ? 0 : key(a) < key(b) ? 1 : -1))
}
