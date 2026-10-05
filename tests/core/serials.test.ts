// Serial numbers: normalising how they're typed, and spotting the same item entered twice.
import { describe, expect, it } from 'vitest'
import { findDuplicateSerials, findSerialClashes, normaliseSerial } from '@/core/serials'

describe('normaliseSerial', () => {
  it.each([
    [' ab-12 34 ', 'AB1234'],
    ['ＡＢ１２', 'AB12'],
    ['12\u201034', '1234'],
    ['12\u201334', '1234'],
    ['', ''],
  ])('normalises %j to %j', (serial, key) => {
    expect(normaliseSerial(serial)).toBe(key)
  })
})

describe('findDuplicateSerials', () => {
  it('groups items whose brand and serial match once normalised', () => {
    const items = [
      { id: 'a', brand: 'Canon', serialNumber: '0123-4567' },
      { id: 'b', brand: 'canon ', serialNumber: '01234567' },
      { id: 'c', brand: 'Sony', serialNumber: '999' },
    ]
    expect(findDuplicateSerials(items)).toEqual([{ serialKey: '01234567', ids: ['a', 'b'] }])
  })

  it('ignores a shared serial across different brands', () => {
    const items = [
      { id: 'a', brand: 'Canon', serialNumber: '12345' },
      { id: 'b', brand: 'Nikon', serialNumber: '12345' },
    ]
    expect(findDuplicateSerials(items)).toEqual([])
  })

  it('ignores items without a serial number', () => {
    const items = [
      { id: 'a', brand: 'Peak Design' },
      { id: 'b', brand: 'Peak Design', serialNumber: '' },
      { id: 'c', brand: 'Peak Design', serialNumber: ' - ' },
    ]
    expect(findDuplicateSerials(items)).toEqual([])
  })

  it('lists every group, sorted by serial', () => {
    const items = [
      { id: 'a', brand: 'Sony', serialNumber: 'Z9' },
      { id: 'b', brand: 'Sony', serialNumber: 'z9' },
      { id: 'c', brand: 'Sony', serialNumber: 'z9' },
      { id: 'd', brand: 'Fujifilm', serialNumber: 'A1' },
      { id: 'e', brand: 'Fujifilm', serialNumber: 'a1' },
    ]
    expect(findDuplicateSerials(items)).toEqual([
      { serialKey: 'A1', ids: ['d', 'e'] },
      { serialKey: 'Z9', ids: ['a', 'b', 'c'] },
    ])
  })
})

describe('findSerialClashes', () => {
  const items = [
    { id: 'a', brand: 'Canon', serialNumber: '0123-4567' },
    { id: 'b', brand: 'Canon', serialNumber: '7654' },
    { id: 'c', brand: 'Nikon', serialNumber: '01234567' },
  ]

  it('finds existing items with the same brand and serial', () => {
    expect(findSerialClashes({ brand: 'CANON', serialNumber: '01234567' }, items)).toEqual(['a'])
  })

  it('leaves out the item being edited', () => {
    expect(findSerialClashes({ brand: 'Canon', serialNumber: '01234567' }, items, 'a')).toEqual([])
  })

  it('finds nothing for an empty serial', () => {
    expect(findSerialClashes({ brand: 'Canon', serialNumber: '' }, items)).toEqual([])
  })
})
