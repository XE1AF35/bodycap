// Storage sizes in words people know, such as 2.4 MB, counting in thousands as storage makers do.
import { describe, expect, it } from 'vitest'
import { formatBytes } from '@/core/bytes'

describe('formatBytes', () => {
  it.each([
    [0, '0 byte'],
    [999, '999 byte'],
    [1000, '1 kB'],
    [2_400_000, '2.4 MB'],
    [2_449_999, '2.4 MB'],
    [120_000_000_000, '120 GB'],
    [1_500_000_000_000, '1,500 GB'],
  ])('writes %i bytes as %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text)
  })
})
