// Shoots: checking a shoot as typed, filling the form back from a saved one, taking an item off a
// shoot, and listing shoots newest first.
import { describe, expect, it } from 'vitest'
import { err, ok } from '@/core/result'
import {
  emptyShootInput,
  newestFirst,
  removeFromShoot,
  toShootInput,
  validateShoot,
  type Shoot,
  type ShootFields,
  type ShootInput,
} from '@/core/shoots'

const TODAY = '2026-10-16'

const typed = (fields: Partial<ShootInput>): ShootInput => ({
  date: '2026-10-11',
  name: 'Kaikoura whales',
  gearIds: [],
  notes: '',
  ...fields,
})

describe('validateShoot', () => {
  it.each<[string, Partial<ShootInput>, ShootFields]>([
    [
      'a date and name with no items',
      {},
      { date: '2026-10-11', name: 'Kaikoura whales', gearIds: [] },
    ],
    [
      'items in the order picked, each once, and tidied text',
      {
        date: ' 2026-10-16 ',
        name: '  Wedding,   Arrowtown ',
        gearIds: ['b', 'a', 'b'],
        notes: 'Rain all day.\r\nUsed the 85 most.',
      },
      {
        date: '2026-10-16',
        name: 'Wedding, Arrowtown',
        gearIds: ['b', 'a'],
        notes: 'Rain all day.\nUsed the 85 most.',
      },
    ],
  ])('reads %s', (_name, fields, expected) => {
    expect(validateShoot(typed(fields), TODAY)).toEqual(ok(expected))
  })

  it.each<[Partial<ShootInput>, keyof ShootInput, string]>([
    [{ date: '' }, 'date', 'Enter the date of the shoot.'],
    [{ date: '2026-02-30' }, 'date', 'Enter a real date.'],
    [{ date: '2026-10-17' }, 'date', "The date can't be in the future."],
    [{ name: '  ' }, 'name', 'Enter a name for the shoot.'],
    [{ name: 'a'.repeat(81) }, 'name', 'Keep the name to 80 characters or fewer.'],
    [{ notes: 'a'.repeat(2001) }, 'notes', 'Keep the notes to 2,000 characters or fewer.'],
  ])('turns down %o, saying what to fix in %s', (fields, field, message) => {
    expect(validateShoot(typed(fields), TODAY)).toEqual(err({ [field]: message }))
  })

  it('reports every problem at once', () => {
    expect(validateShoot(typed({ date: '', name: '', notes: 'a'.repeat(2001) }), TODAY)).toEqual(
      err({
        date: 'Enter the date of the shoot.',
        name: 'Enter a name for the shoot.',
        notes: 'Keep the notes to 2,000 characters or fewer.',
      }),
    )
  })

  it.each<ShootFields>([
    { date: '2026-10-11', name: 'Kaikoura whales', gearIds: [] },
    { date: '2026-01-02', name: 'Hooker Valley', gearIds: ['a', 'b'], notes: 'Two\nlines' },
  ])('fills the form so that saving %o unchanged gives it back exactly', (fields) => {
    expect(validateShoot(toShootInput(fields), TODAY)).toEqual(ok(fields))
  })

  it('starts a blank form on today, with no items', () => {
    expect(emptyShootInput(TODAY)).toEqual({ date: TODAY, name: '', gearIds: [], notes: '' })
  })
})

describe('removeFromShoot', () => {
  const shoot: ShootFields = { date: TODAY, name: 'Wedding', gearIds: ['a', 'b', 'c'] }

  it('takes an item off the shoot, keeping the rest in order', () => {
    expect(removeFromShoot(shoot, 'b')).toEqual({ ...shoot, gearIds: ['a', 'c'] })
  })

  it('leaves the shoot as it was when the item is not on it', () => {
    expect(removeFromShoot(shoot, 'z')).toEqual(shoot)
  })
})

describe('newestFirst', () => {
  const shoot = (id: string, date: string, createdAt: string): Shoot => ({
    id,
    date,
    createdAt,
    updatedAt: createdAt,
    name: id,
    gearIds: [],
  })

  it('lists shoots by date, newest first, and the latest logged first on the same day', () => {
    const shoots = [
      shoot('older', '2026-09-01', '2026-09-01T01:00:00.000Z'),
      shoot('morning', '2026-10-11', '2026-10-11T01:00:00.000Z'),
      shoot('newest', '2026-10-12', '2026-10-12T01:00:00.000Z'),
      shoot('evening', '2026-10-11', '2026-10-11T08:00:00.000Z'),
    ]
    expect(newestFirst(shoots).map(({ id }) => id)).toEqual([
      'newest',
      'evening',
      'morning',
      'older',
    ])
  })

  it('leaves the list it was given as it was', () => {
    const shoots = [
      shoot('a', '2026-09-01', '2026-09-01T01:00:00.000Z'),
      shoot('b', '2026-10-01', '2026-10-01T01:00:00.000Z'),
    ]
    newestFirst(shoots)
    expect(shoots.map(({ id }) => id)).toEqual(['a', 'b'])
  })
})
