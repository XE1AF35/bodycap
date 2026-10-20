// Usage: how many shoots an item has been on and when it was last used, and which held items
// haven't been on a shoot in the past year.
import { describe, expect, it } from 'vitest'
import type { Category, Status } from '@/core/gear'
import { unusedItems, usageOf } from '@/core/usage'

const TODAY = '2026-10-16'

const shoot = (date: string, gearIds: readonly string[]) => ({ date, gearIds })

describe('usageOf', () => {
  it('counts the shoots an item was on and gives the date of the latest', () => {
    const shoots = [
      shoot('2026-03-01', ['body', 'lens']),
      shoot('2026-09-12', ['body']),
      shoot('2025-12-24', ['body', 'flash']),
    ]
    expect(usageOf('body', shoots)).toEqual({ count: 3, lastUsed: '2026-09-12' })
    expect(usageOf('lens', shoots)).toEqual({ count: 1, lastUsed: '2026-03-01' })
  })

  it('gives no date for an item never on a shoot', () => {
    expect(usageOf('tripod', [shoot('2026-03-01', ['body'])])).toEqual({ count: 0 })
  })
})

describe('unusedItems', () => {
  const item = (id: string, category: Category, status: Status = 'owned') => ({
    id,
    category,
    status,
  })

  it('lists held bodies, lenses, flashes, and drones with no shoot in the past year', () => {
    const items = [
      item('body', 'camera-body'),
      item('lens', 'lens', 'lent-out'),
      item('flash', 'flash', 'in-repair'),
      item('drone', 'drone'),
      item('tripod', 'tripod'),
      item('card', 'memory-card'),
    ]
    expect(unusedItems(items, [], TODAY)).toEqual([
      { item: items[0], usage: { count: 0 } },
      { item: items[1], usage: { count: 0 } },
      { item: items[2], usage: { count: 0 } },
      { item: items[3], usage: { count: 0 } },
    ])
  })

  it('leaves out wishlist, sold, and lost items', () => {
    const items = [
      item('wanted', 'lens', 'wishlist'),
      item('sold', 'lens', 'sold'),
      item('lost', 'lens', 'lost'),
    ]
    expect(unusedItems(items, [], TODAY)).toEqual([])
  })

  it('counts a shoot exactly 365 days before today as in the past year, and one day earlier not', () => {
    const items = [item('recent', 'lens'), item('old', 'lens')]
    const shoots = [shoot('2025-10-16', ['recent']), shoot('2025-10-15', ['old'])]
    expect(unusedItems(items, shoots, TODAY)).toEqual([
      { item: items[1], usage: { count: 1, lastUsed: '2025-10-15' } },
    ])
  })

  it('puts items never on a shoot first, then the longest unused', () => {
    const items = [item('a', 'lens'), item('b', 'lens'), item('c', 'lens'), item('d', 'lens')]
    const shoots = [
      shoot('2024-05-01', ['a']),
      shoot('2023-01-09', ['c']),
      shoot('2024-02-01', ['a', 'c']),
    ]
    expect(unusedItems(items, shoots, TODAY).map(({ item }) => item.id)).toEqual([
      'b',
      'd',
      'c',
      'a',
    ])
  })
})
