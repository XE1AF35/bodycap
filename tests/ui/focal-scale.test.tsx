// The scale the focal length strips share: logarithmic, with room either side, and tick labels
// that never crowd each other.
import { describe, expect, it } from 'vitest'
import { focalScale } from '@/ui/system/focal-scale'

describe('focalScale', () => {
  it('has nothing to draw without focal lengths', () => {
    expect(focalScale([])).toBeUndefined()
  })

  it('places focal lengths logarithmically, so each doubling is the same distance', () => {
    const scale = focalScale([{ min: 16, max: 600 }])
    if (scale === undefined) throw new Error('No scale')
    expect(scale.at(50) - scale.at(25)).toBeCloseTo(scale.at(400) - scale.at(200))
    expect(scale.at(16)).toBeGreaterThan(0)
    expect(scale.at(600)).toBeLessThan(100)
  })

  it('centres a single prime, with room around it', () => {
    const scale = focalScale([{ min: 50, max: 50 }])
    expect(scale?.at(50)).toBeCloseTo(50)
    expect(scale?.ticks.length).toBeGreaterThan(1)
  })

  it.each([
    [[{ min: 16, max: 600 }]],
    [
      [
        { min: 8, max: 15 },
        { min: 600, max: 1200 },
      ],
    ],
    [[{ min: 35, max: 85 }]],
  ])('keeps tick labels inside the strip and apart, for %j', (ranges) => {
    const scale = focalScale(ranges)
    if (scale === undefined) throw new Error('No scale')
    const positions = scale.ticks.map((tick) => scale.at(tick))
    expect(positions.length).toBeGreaterThan(1)
    for (const [index, position] of positions.entries()) {
      expect(position).toBeGreaterThanOrEqual(4)
      expect(position).toBeLessThanOrEqual(96)
      if (index > 0) expect(position - (positions[index - 1] ?? 0)).toBeGreaterThanOrEqual(9)
    }
  })
})
