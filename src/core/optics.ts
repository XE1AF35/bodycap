// Lens optics: the focal length range, and the widest aperture at each end. A prime has one focal
// length. A zoom has a range, and many zooms open less wide at the long end, such as f/3.5-5.6.
import type { Category } from './gear'
import { LOCALE } from './locale'
import { err, ok, type Result } from './result'

/** In millimetres: from the widest fisheyes to the longest lens ever sold, with room to spare */
export const FOCAL_LENGTH_RANGE = { min: 1, max: 6000 } as const

/** As f-numbers: from the fastest lenses made to the slowest */
export const F_NUMBER_RANGE = { min: 0.7, max: 64 } as const

export interface LensOptics {
  /** Millimetres. A prime has the same minimum and maximum. */
  readonly focalLengthMin?: number
  readonly focalLengthMax?: number
  /** The widest aperture, as an f-number, at the wide end */
  readonly maxAperture?: number
  /** The widest aperture at the long end, kept only when it's narrower than at the wide end */
  readonly maxApertureTele?: number
}

export const OPTICS_FIELDS = [
  'focalLengthMin',
  'focalLengthMax',
  'maxAperture',
  'maxApertureTele',
] as const satisfies readonly (keyof LensOptics)[]

/** What the form holds for a lens's optics, as typed */
export type OpticsInput = Record<(typeof OPTICS_FIELDS)[number], string>

export type OpticsErrors = Partial<Record<keyof OpticsInput, string>>

/**
 * Whether an item has optics recorded. Lenses only, on the wishlist too, since a lens you want can
 * fill a gap in your focal lengths.
 */
export function hasOptics(category: Category): boolean {
  return category === 'lens'
}

// Up to four digits and one decimal place, as lenses are named, with "mm" allowed after
const FOCAL_LENGTH = /^(\d{1,4}(?:\.\d)?)\s*(?:mm)?$/i
// Written 2.8, f2.8, or f/2.8, with up to two decimal places for lenses such as f/0.95
const F_NUMBER = /^(?:f\s*\/?\s*)?(\d{1,2}(?:\.\d{1,2})?)$/i

const count = new Intl.NumberFormat(LOCALE)

interface NumberRule {
  readonly pattern: RegExp
  readonly range: { readonly min: number; readonly max: number }
  readonly unclear: string
  readonly outOfRange: string
}

const FOCAL_LENGTH_RULE: NumberRule = {
  pattern: FOCAL_LENGTH,
  range: FOCAL_LENGTH_RANGE,
  unclear: 'Enter a focal length in millimetres, such as 35 or 4.5.',
  outOfRange: `Enter a focal length from ${count.format(FOCAL_LENGTH_RANGE.min)} to ${count.format(FOCAL_LENGTH_RANGE.max)} mm.`,
}

const F_NUMBER_RULE: NumberRule = {
  pattern: F_NUMBER,
  range: F_NUMBER_RANGE,
  unclear: 'Enter an f-number, such as 2.8.',
  outOfRange: `Enter an f-number from ${count.format(F_NUMBER_RANGE.min)} to ${count.format(F_NUMBER_RANGE.max)}.`,
}

/** A number as typed: nothing if blank, or a message if it can't be read or is out of range */
function readNumber(text: string, rule: NumberRule): Result<number | undefined> {
  const value = text.trim()
  if (value === '') return ok(undefined)
  const digits = rule.pattern.exec(value)?.[1]
  if (digits === undefined) return err(rule.unclear)
  const number = Number(digits)
  return number < rule.range.min || number > rule.range.max ? err(rule.outOfRange) : ok(number)
}

/** Checks a lens's optics as typed. All problems are reported together, as with the rest of the form. */
export function validateOptics(input: OpticsInput): Result<LensOptics, OpticsErrors> {
  const errors: OpticsErrors = {}
  const read = (field: keyof OpticsInput, rule: NumberRule) => {
    const result = readNumber(input[field], rule)
    if (result.ok) return result.value
    errors[field] = result.error
    return undefined
  }

  const typedMin = read('focalLengthMin', FOCAL_LENGTH_RULE)
  const typedMax = read('focalLengthMax', FOCAL_LENGTH_RULE)
  // One focal length on its own is a prime
  const min = typedMin ?? typedMax
  const max = typedMax ?? typedMin
  if (min !== undefined && max !== undefined && max < min) {
    errors.focalLengthMax = "The longest focal length can't be shorter than the shortest."
  }

  // A larger f-number is a narrower aperture
  const wide = read('maxAperture', F_NUMBER_RULE)
  const tele = read('maxApertureTele', F_NUMBER_RULE)
  if (tele !== undefined) {
    if (wide === undefined) errors.maxAperture ??= 'Enter the widest aperture at the wide end too.'
    else if (tele < wide)
      errors.maxApertureTele = "The long end can't open wider than the wide end."
    else if (tele > wide && min !== undefined && min === max) {
      errors.maxApertureTele = 'A prime lens has one widest aperture.'
    }
  }

  if (Object.keys(errors).length > 0) return err(errors)
  return ok({
    ...(min !== undefined && max !== undefined ? { focalLengthMin: min, focalLengthMax: max } : {}),
    ...(wide !== undefined ? { maxAperture: wide } : {}),
    // A constant aperture is kept once
    ...(wide !== undefined && tele !== undefined && tele > wide ? { maxApertureTele: tele } : {}),
  })
}

/** Fills the form's optics fields from a saved lens */
export function toOpticsInput(optics: LensOptics): OpticsInput {
  const text = (value?: number) => (value === undefined ? '' : String(value))
  return {
    focalLengthMin: text(optics.focalLengthMin),
    focalLengthMax: text(optics.focalLengthMax),
    maxAperture: text(optics.maxAperture),
    maxApertureTele: text(optics.maxApertureTele),
  }
}

// Lens names never group digits, so a 1200mm lens isn't written 1,200mm
const millimetres = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1, useGrouping: false })
const fNumber = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2, useGrouping: false })

/** Such as "50mm" */
export function formatMillimetres(value: number): string {
  return `${millimetres.format(value)}mm`
}

/** Such as "50mm" for a prime or "24-70mm" for a zoom, as lenses are named */
export function formatFocalLength({
  focalLengthMin: min,
  focalLengthMax: max,
}: LensOptics): string | undefined {
  if (min === undefined || max === undefined) return undefined
  if (min === max) return formatMillimetres(min)
  return `${millimetres.format(min)}-${formatMillimetres(max)}`
}

/** Such as "f/2.8", or "f/3.5-5.6" for a zoom that opens less wide at the long end */
export function formatAperture({
  maxAperture: wide,
  maxApertureTele: tele,
}: LensOptics): string | undefined {
  if (wide === undefined) return undefined
  if (tele === undefined) return `f/${fNumber.format(wide)}`
  return `f/${fNumber.format(wide)}-${fNumber.format(tele)}`
}
