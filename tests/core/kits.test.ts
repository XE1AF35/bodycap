// Kits: checking a kit's name and description, adding and removing gear, and the packing checklist
// turned on and off, ticked, and reset.
import { describe, expect, it } from 'vitest'
import {
  addToKit,
  kitGear,
  newKit,
  packingProgress,
  removeFromKit,
  resetPacking,
  setChecklist,
  setPacked,
  toKitInput,
  validateKit,
  withDetails,
  type KitDetails,
  type KitFields,
  type KitInput,
} from '@/core/kits'
import { err, ok } from '@/core/result'

const kit = (fields: Partial<KitFields> = {}): KitFields => ({
  ...newKit({ name: 'Wedding' }),
  ...fields,
})

const typed = (fields: Partial<KitInput>): KitInput => ({
  name: 'Wedding',
  description: '',
  ...fields,
})

describe('validateKit', () => {
  it.each<[string, Partial<KitInput>, KitDetails]>([
    ['a name on its own', {}, { name: 'Wedding' }],
    [
      'a name and description, tidied',
      { name: '  Travel   light ', description: 'One body, two primes.\r\nFits the sling.' },
      { name: 'Travel light', description: 'One body, two primes.\nFits the sling.' },
    ],
  ])('reads %s', (_name, fields, expected) => {
    expect(validateKit(typed(fields))).toEqual(ok(expected))
  })

  it.each<[Partial<KitInput>, keyof KitInput, string]>([
    [{ name: '  ' }, 'name', 'Enter a name for the kit.'],
    [{ name: 'a'.repeat(81) }, 'name', 'Keep the name to 80 characters or fewer.'],
    [
      { description: 'a'.repeat(1001) },
      'description',
      'Keep the description to 1,000 characters or fewer.',
    ],
  ])('turns down %o, saying what to fix in %s', (fields, field, message) => {
    expect(validateKit(typed(fields))).toEqual(err({ [field]: message }))
  })

  it.each<KitDetails>([{ name: 'Wedding' }, { name: 'Travel light', description: 'Two\nlines' }])(
    'fills the form so that saving %o unchanged gives it back exactly',
    (details) => {
      expect(validateKit(toKitInput(details))).toEqual(ok(details))
    },
  )
})

describe('withDetails', () => {
  const packing = kit({
    description: 'Two bodies',
    gearIds: ['a', 'b'],
    checklist: true,
    packedGearIds: ['a'],
  })

  it('renames a kit, keeping its gear and ticks', () => {
    expect(
      withDetails(packing, { name: 'Weddings', description: 'Two bodies, one flash' }),
    ).toEqual({
      ...packing,
      name: 'Weddings',
      description: 'Two bodies, one flash',
    })
  })

  it('drops a description cleared in the form', () => {
    expect(withDetails(packing, { name: 'Weddings' })).not.toHaveProperty('description')
  })
})

describe('newKit', () => {
  it('starts empty, as a plain collection with the checklist off', () => {
    expect(newKit({ name: 'Wedding', description: 'Two bodies' })).toEqual({
      name: 'Wedding',
      description: 'Two bodies',
      gearIds: [],
      checklist: false,
      packedGearIds: [],
    })
  })
})

describe('adding and removing gear', () => {
  it('adds gear to the end, skipping anything already in the kit', () => {
    expect(addToKit(kit({ gearIds: ['a'] }), ['b', 'a', 'c', 'b']).gearIds).toEqual(['a', 'b', 'c'])
  })

  it('takes an item out of the kit and off the packing list', () => {
    const packing = kit({ gearIds: ['a', 'b', 'c'], checklist: true, packedGearIds: ['b', 'c'] })
    expect(removeFromKit(packing, 'b')).toEqual({
      ...packing,
      gearIds: ['a', 'c'],
      packedGearIds: ['c'],
    })
  })

  it('leaves the kit as it was when the item is not in it', () => {
    const before = kit({ gearIds: ['a'] })
    expect(removeFromKit(before, 'z')).toEqual(before)
  })
})

describe('the packing checklist', () => {
  const packing = kit({ gearIds: ['a', 'b', 'c'], checklist: true })

  it('turns on with nothing ticked yet', () => {
    expect(setChecklist(kit({ gearIds: ['a'] }), true)).toMatchObject({
      checklist: true,
      packedGearIds: [],
    })
  })

  it('forgets what was ticked when it is turned off', () => {
    expect(setChecklist({ ...packing, packedGearIds: ['a'] }, false)).toMatchObject({
      checklist: false,
      packedGearIds: [],
    })
  })

  it('ticks and unticks an item, never listing it twice', () => {
    const ticked = setPacked(setPacked(packing, 'b', true), 'b', true)
    expect(ticked.packedGearIds).toEqual(['b'])
    expect(setPacked(ticked, 'b', false).packedGearIds).toEqual([])
  })

  it.each<[string, KitFields, string]>([
    ['while the checklist is off', kit({ gearIds: ['a'] }), 'a'],
    ['for an item that is not in the kit', packing, 'z'],
  ])('ticks nothing %s', (_name, before, gearId) => {
    expect(setPacked(before, gearId, true)).toEqual(before)
  })

  it('unticks everything to pack again, keeping the checklist on', () => {
    expect(resetPacking({ ...packing, packedGearIds: ['a', 'c'] })).toEqual(packing)
  })

  it('counts what is packed out of the whole kit', () => {
    expect(packingProgress({ ...packing, packedGearIds: ['a', 'c'] })).toEqual({
      packed: 2,
      total: 3,
    })
  })

  it('has no progress to show while the checklist is off', () => {
    expect(packingProgress(kit({ gearIds: ['a'] }))).toBeUndefined()
  })
})

describe('kitGear', () => {
  it("lists the kit's gear in the kit's order, leaving out any that is gone", () => {
    const gear = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(kitGear(kit({ gearIds: ['c', 'gone', 'a'] }), gear)).toEqual([{ id: 'c' }, { id: 'a' }])
  })
})
