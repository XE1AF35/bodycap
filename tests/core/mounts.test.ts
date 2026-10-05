// The lens mount and sensor format lists that gear records refer to.
import { describe, expect, it } from 'vitest'
import { MOUNT_LABELS, MOUNTS, SENSOR_FORMAT_LABELS, SENSOR_FORMATS } from '@/core/mounts'

describe('mounts', () => {
  it('has unique mount IDs, each with a label', () => {
    expect(new Set(MOUNTS).size).toBe(MOUNTS.length)
    for (const mount of MOUNTS) expect(MOUNT_LABELS[mount], mount).toBeTruthy()
  })

  it('has unique sensor formats, each with a label', () => {
    expect(new Set(SENSOR_FORMATS).size).toBe(SENSOR_FORMATS.length)
    for (const format of SENSOR_FORMATS) expect(SENSOR_FORMAT_LABELS[format], format).toBeTruthy()
  })
})
