// The scale every focal length strip on the system map shares, so they line up. It's logarithmic,
// as photographers think of focal lengths in steps: 24 to 50mm is about as far as 200 to 400mm.
import type { FocalRange } from '@/core/system-map'

// The labels photographers know, from fisheye to the longest telephotos
const TICKS = [
  8, 10, 12, 14, 16, 18, 20, 24, 28, 35, 50, 70, 85, 105, 135, 200, 300, 400, 500, 600, 800, 1000,
  1200, 1600, 2000,
]
/** Room either side of the shortest and longest focal lengths */
const PADDING = 1.15
/** The least the strip spans, as a ratio, so a lone prime still has a scale around it */
const LEAST_SPAN = 4
/** Percentages: labels stay this far in from the ends, and this far apart */
const EDGE = 4
const TICK_GAP = 9

export interface FocalScale {
  /** Where a focal length sits along the strip, as a percentage of its width */
  readonly at: (millimetres: number) => number
  readonly ticks: readonly number[]
}

export function focalScale(ranges: readonly FocalRange[]): FocalScale | undefined {
  if (ranges.length === 0) return undefined
  let low = Math.log(Math.min(...ranges.map(({ min }) => min)) / PADDING)
  let high = Math.log(Math.max(...ranges.map(({ max }) => max)) * PADDING)
  const short = Math.log(LEAST_SPAN) - (high - low)
  if (short > 0) {
    low -= short / 2
    high += short / 2
  }
  const at = (millimetres: number) => ((Math.log(millimetres) - low) / (high - low)) * 100

  const ticks: number[] = []
  for (const tick of TICKS) {
    const position = at(tick)
    const previous = ticks.at(-1)
    if (position < EDGE || position > 100 - EDGE) continue
    if (previous !== undefined && position - at(previous) < TICK_GAP) continue
    ticks.push(tick)
  }
  return { at, ticks }
}
