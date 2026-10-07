// Lens optics: reading focal lengths and apertures as typed, the rules between them, which items
// have them, and how they're written for display.
import { describe, expect, it } from 'vitest'
import { CATEGORIES } from '@/core/gear'
import {
  formatAperture,
  formatFocalLength,
  hasOptics,
  toOpticsInput,
  validateOptics,
  type LensOptics,
  type OpticsInput,
} from '@/core/optics'

const BLANK: OpticsInput = {
  focalLengthMin: '',
  focalLengthMax: '',
  maxAperture: '',
  maxApertureTele: '',
}

const typed = (fields: Partial<OpticsInput>): OpticsInput => ({ ...BLANK, ...fields })

describe('validateOptics', () => {
  it.each<[string, Partial<OpticsInput>, LensOptics]>([
    ['nothing at all', {}, {}],
    [
      'a zoom with a constant aperture',
      { focalLengthMin: '24', focalLengthMax: '70', maxAperture: '2.8' },
      { focalLengthMin: 24, focalLengthMax: 70, maxAperture: 2.8 },
    ],
    [
      'a zoom that opens less wide at the long end',
      { focalLengthMin: '18', focalLengthMax: '55', maxAperture: '3.5', maxApertureTele: '5.6' },
      { focalLengthMin: 18, focalLengthMax: 55, maxAperture: 3.5, maxApertureTele: 5.6 },
    ],
    [
      'a prime given as the shortest focal length only',
      { focalLengthMin: '50', maxAperture: '1.8' },
      { focalLengthMin: 50, focalLengthMax: 50, maxAperture: 1.8 },
    ],
    [
      'a prime given as the longest focal length only',
      { focalLengthMax: '85', maxAperture: '1.4' },
      { focalLengthMin: 85, focalLengthMax: 85, maxAperture: 1.4 },
    ],
    [
      'millimetres and f-numbers written the ways lenses print them',
      { focalLengthMin: '24 mm', focalLengthMax: '70MM', maxAperture: 'f/2.8' },
      { focalLengthMin: 24, focalLengthMax: 70, maxAperture: 2.8 },
    ],
    [
      'an f-number written f2 or F/4',
      { maxAperture: 'f2', maxApertureTele: 'F/4' },
      { maxAperture: 2, maxApertureTele: 4 },
    ],
    [
      'a fisheye focal length and a very fast aperture',
      { focalLengthMin: '4.5', maxAperture: '0.95' },
      { focalLengthMin: 4.5, focalLengthMax: 4.5, maxAperture: 0.95 },
    ],
    [
      'the longest and slowest a lens can be',
      { focalLengthMin: '6000', maxAperture: '64' },
      { focalLengthMin: 6000, focalLengthMax: 6000, maxAperture: 64 },
    ],
    [
      'a constant aperture typed at both ends, kept once',
      { focalLengthMin: '70', focalLengthMax: '200', maxAperture: '4', maxApertureTele: '4' },
      { focalLengthMin: 70, focalLengthMax: 200, maxAperture: 4 },
    ],
    [
      'apertures with no focal length yet',
      { maxAperture: '3.5', maxApertureTele: '5.6' },
      { maxAperture: 3.5, maxApertureTele: 5.6 },
    ],
    [
      'spaces around what was typed',
      { focalLengthMin: ' 35 ', maxAperture: ' 1.4 ' },
      { focalLengthMin: 35, focalLengthMax: 35, maxAperture: 1.4 },
    ],
  ])('reads %s', (_name, fields, expected) => {
    expect(validateOptics(typed(fields))).toEqual({ ok: true, value: expected })
  })

  it.each<[Partial<OpticsInput>, keyof OpticsInput, string]>([
    [
      { focalLengthMin: 'wide' },
      'focalLengthMin',
      'Enter a focal length in millimetres, such as 35 or 4.5.',
    ],
    [
      { focalLengthMin: '24-70' },
      'focalLengthMin',
      'Enter a focal length in millimetres, such as 35 or 4.5.',
    ],
    [
      { focalLengthMax: '1,200' },
      'focalLengthMax',
      'Enter a focal length in millimetres, such as 35 or 4.5.',
    ],
    [
      { focalLengthMin: '10.55' },
      'focalLengthMin',
      'Enter a focal length in millimetres, such as 35 or 4.5.',
    ],
    [{ focalLengthMin: '0' }, 'focalLengthMin', 'Enter a focal length from 1 to 6,000 mm.'],
    [{ focalLengthMax: '6001' }, 'focalLengthMax', 'Enter a focal length from 1 to 6,000 mm.'],
    [
      { focalLengthMin: '70', focalLengthMax: '24' },
      'focalLengthMax',
      "The longest focal length can't be shorter than the shortest.",
    ],
    [{ maxAperture: 'fast' }, 'maxAperture', 'Enter an f-number, such as 2.8.'],
    [{ maxAperture: 'f/2.8-4' }, 'maxAperture', 'Enter an f-number, such as 2.8.'],
    [{ maxAperture: '0.5' }, 'maxAperture', 'Enter an f-number from 0.7 to 64.'],
    [{ maxApertureTele: '90' }, 'maxApertureTele', 'Enter an f-number from 0.7 to 64.'],
    [{ maxApertureTele: '5.6' }, 'maxAperture', 'Enter the widest aperture at the wide end too.'],
    [
      { focalLengthMin: '18', focalLengthMax: '55', maxAperture: '5.6', maxApertureTele: '3.5' },
      'maxApertureTele',
      "The long end can't open wider than the wide end.",
    ],
    [
      { focalLengthMin: '50', maxAperture: '1.8', maxApertureTele: '2.8' },
      'maxApertureTele',
      'A prime lens has one widest aperture.',
    ],
  ])('turns down %o, saying what to fix in %s', (fields, field, message) => {
    expect(validateOptics(typed(fields))).toMatchObject({ ok: false, error: { [field]: message } })
  })

  it('reports every problem at once', () => {
    const result = validateOptics(typed({ focalLengthMin: 'wide', maxAperture: 'fast' }))
    expect(result).toEqual({
      ok: false,
      error: {
        focalLengthMin: 'Enter a focal length in millimetres, such as 35 or 4.5.',
        maxAperture: 'Enter an f-number, such as 2.8.',
      },
    })
  })

  it('keeps the message about how an aperture is written, rather than a missing one', () => {
    expect(validateOptics(typed({ maxAperture: 'fast', maxApertureTele: '5.6' }))).toMatchObject({
      ok: false,
      error: { maxAperture: 'Enter an f-number, such as 2.8.' },
    })
  })
})

describe('toOpticsInput', () => {
  it.each<LensOptics>([
    {},
    { focalLengthMin: 50, focalLengthMax: 50, maxAperture: 1.8 },
    { focalLengthMin: 4.5, focalLengthMax: 4.5, maxAperture: 0.95 },
    { focalLengthMin: 100, focalLengthMax: 400, maxAperture: 4.5, maxApertureTele: 5.6 },
    { focalLengthMin: 1200, focalLengthMax: 1700, maxAperture: 5.6, maxApertureTele: 8 },
  ])('fills the form so that saving %o unchanged gives it back exactly', (optics) => {
    expect(validateOptics(toOpticsInput(optics))).toEqual({ ok: true, value: optics })
  })

  it('leaves the fields blank for a lens with nothing recorded', () => {
    expect(toOpticsInput({})).toEqual(BLANK)
  })
})

describe('formatFocalLength', () => {
  it.each<[LensOptics, string | undefined]>([
    [{}, undefined],
    [{ maxAperture: 2.8 }, undefined],
    [{ focalLengthMin: 50, focalLengthMax: 50 }, '50mm'],
    [{ focalLengthMin: 24, focalLengthMax: 70 }, '24-70mm'],
    [{ focalLengthMin: 4.5, focalLengthMax: 4.5 }, '4.5mm'],
    [{ focalLengthMin: 10.5, focalLengthMax: 17 }, '10.5-17mm'],
    [{ focalLengthMin: 1200, focalLengthMax: 1700 }, '1200-1700mm'],
  ])('writes %o as %s', (optics, expected) => {
    expect(formatFocalLength(optics)).toBe(expected)
  })
})

describe('formatAperture', () => {
  it.each<[LensOptics, string | undefined]>([
    [{}, undefined],
    [{ focalLengthMin: 50, focalLengthMax: 50 }, undefined],
    [{ maxAperture: 2.8 }, 'f/2.8'],
    [{ maxAperture: 2 }, 'f/2'],
    [{ maxAperture: 0.95 }, 'f/0.95'],
    [{ maxAperture: 3.5, maxApertureTele: 5.6 }, 'f/3.5-5.6'],
  ])('writes %o as %s', (optics, expected) => {
    expect(formatAperture(optics)).toBe(expected)
  })
})

describe('hasOptics', () => {
  it.each(CATEGORIES)('records optics for a %s only if it is a lens', (category) => {
    expect(hasOptics(category)).toBe(category === 'lens')
  })
})
