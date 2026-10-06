// The lens mount and sensor format lists that gear records refer to, and which mounts fit which.
import { describe, expect, it } from 'vitest'
import {
  ADAPTS_TO,
  FLANGE_MM,
  fitsNatively,
  MOUNT_CODES,
  MOUNT_LABELS,
  MOUNTS,
  SENSOR_FORMAT_LABELS,
  SENSOR_FORMATS,
} from '@/core/mounts'

describe('mounts', () => {
  it('has unique mount IDs, each with a label', () => {
    expect(new Set(MOUNTS).size).toBe(MOUNTS.length)
    for (const mount of MOUNTS) expect(MOUNT_LABELS[mount], mount).toBeTruthy()
  })

  it('gives each mount a short code of its own, for badges', () => {
    const codes = MOUNTS.map((mount) => MOUNT_CODES[mount])
    expect(new Set(codes).size).toBe(MOUNTS.length)
    for (const code of codes) expect(code).toMatch(/^[A-Z0-9-]{1,4}$/)
  })

  it('has unique sensor formats, each with a label', () => {
    expect(new Set(SENSOR_FORMATS).size).toBe(SENSOR_FORMATS.length)
    for (const format of SENSOR_FORMATS) expect(SENSOR_FORMAT_LABELS[format], format).toBeTruthy()
  })
})

describe('fitsNatively', () => {
  it.each([
    ['sony-e', 'sony-e', true],
    ['canon-ef', 'canon-ef-s', true],
    ['canon-ef-s', 'canon-ef', false],
    ['canon-ef', 'canon-rf', false],
    ['m42', 'pentax-k', false],
  ] as const)('a %s lens on a %s camera: %s', (lens, camera, fits) => {
    expect(fitsNatively(lens, camera)).toBe(fits)
  })
})

describe('ADAPTS_TO', () => {
  const pairs = MOUNTS.flatMap((lens) => ADAPTS_TO[lens].map((camera) => [lens, camera] as const))

  // Pentax's own adapter sits inside the K mount, so M42 lenses need no extra room there
  const needRoom = pairs.filter(([lens, camera]) => !(lens === 'm42' && camera === 'pentax-k'))

  it.each(needRoom)('leaves room for a %s to %s adapter', (lens, camera) => {
    expect(FLANGE_MM[lens] - FLANGE_MM[camera]).toBeGreaterThanOrEqual(1)
  })

  it.each(pairs)('lists %s to %s only because it needs an adapter', (lens, camera) => {
    expect(fitsNatively(lens, camera)).toBe(false)
  })
})
