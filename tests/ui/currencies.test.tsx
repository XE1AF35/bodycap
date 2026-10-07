// The currency new amounts start in: the one chosen in Settings, else the one used last, else NZD.
import { describe, expect, it } from 'vitest'
import type { Settings } from '@/data/repositories'
import { startingCurrency } from '@/ui/gear/form/currencies'

describe('startingCurrency', () => {
  it.each<[string, Settings | undefined, string]>([
    [
      'the one chosen in Settings',
      { changesSinceBackup: 0, defaultCurrency: 'AUD', lastUsedCurrency: 'USD' },
      'AUD',
    ],
    [
      'the one used last, when none is chosen',
      { changesSinceBackup: 0, lastUsedCurrency: 'USD' },
      'USD',
    ],
    ['NZD, before any amount is saved', { changesSinceBackup: 0 }, 'NZD'],
    ["NZD, when the settings can't be read", undefined, 'NZD'],
  ])('starts in %s', (_name, settings, expected) => {
    expect(startingCurrency(settings)).toBe(expected)
  })
})
