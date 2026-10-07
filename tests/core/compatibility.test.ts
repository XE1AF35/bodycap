// Lens and camera compatibility: native fits, crop mode, adapters you own, and adapters you'd need,
// and each lens or body checked against the other kind you have, best fits first.
import { describe, expect, it } from 'vitest'
import {
  checkCompatibility,
  compatibleGear,
  type Adapter,
  type Body,
  type Lens,
} from '@/core/compatibility'
import type { Gear, GearFields } from '@/core/gear'

const ftz: Adapter = {
  id: 'ftz',
  adapterFrom: 'nikon-f',
  adapterTo: 'nikon-z',
  adapterAutofocus: true,
}
const m42ToEf: Adapter = { id: 'm42-ef', adapterFrom: 'm42', adapterTo: 'canon-ef' }
const efToRf: Adapter = {
  id: 'ef-rf',
  adapterFrom: 'canon-ef',
  adapterTo: 'canon-rf',
  adapterAutofocus: true,
}

describe('checkCompatibility', () => {
  it.each<[string, boolean, Lens, Body]>([
    [
      'an RF lens on an RF camera',
      false,
      { mount: 'canon-rf', lensCoverage: 'full-frame' },
      { mount: 'canon-rf', sensorFormat: 'full-frame' },
    ],
    [
      'a full-frame lens on an APS-C camera',
      false,
      { mount: 'sony-e', lensCoverage: 'full-frame' },
      { mount: 'sony-e', sensorFormat: 'aps-c' },
    ],
    [
      'an EF lens on an EF-S camera',
      false,
      { mount: 'canon-ef', lensCoverage: 'full-frame' },
      { mount: 'canon-ef-s', sensorFormat: 'aps-c' },
    ],
    [
      'an RF-S lens on a full-frame RF camera',
      true,
      { mount: 'canon-rf', lensCoverage: 'aps-c' },
      { mount: 'canon-rf', sensorFormat: 'full-frame' },
    ],
    [
      'a DX lens on a full-frame Nikon Z camera',
      true,
      { mount: 'nikon-z', lensCoverage: 'aps-c' },
      { mount: 'nikon-z', sensorFormat: 'full-frame' },
    ],
    [
      'a lens whose coverage is unknown',
      false,
      { mount: 'nikon-z' },
      { mount: 'nikon-z', sensorFormat: 'full-frame' },
    ],
    [
      'a camera whose sensor is unknown',
      false,
      { mount: 'nikon-z', lensCoverage: 'aps-c' },
      { mount: 'nikon-z' },
    ],
  ])('fits %s natively, cropping: %s', (_name, crop, lens, body) => {
    expect(checkCompatibility(lens, body, [ftz])).toEqual({ fit: 'native', crop })
  })

  it.each<[string, Lens, Body, readonly Adapter[], Adapter, boolean]>([
    [
      'an F lens on a Z camera with an FTZ',
      { mount: 'nikon-f', lensCoverage: 'full-frame' },
      { mount: 'nikon-z', sensorFormat: 'full-frame' },
      [m42ToEf, ftz],
      ftz,
      false,
    ],
    [
      'an M42 lens on an EF-S camera with a manual focus adapter',
      { mount: 'm42' },
      { mount: 'canon-ef-s', sensorFormat: 'aps-c' },
      [m42ToEf],
      m42ToEf,
      false,
    ],
    [
      'an EF-S lens on a full-frame RF camera with an EF adapter',
      { mount: 'canon-ef-s', lensCoverage: 'aps-c' },
      { mount: 'canon-rf', sensorFormat: 'full-frame' },
      [efToRf],
      efToRf,
      true,
    ],
  ])('works with %s', (_name, lens, body, adapters, adapter, crop) => {
    expect(checkCompatibility(lens, body, adapters)).toEqual({
      fit: 'adapter',
      adapterId: adapter.id,
      autofocus: adapter.adapterAutofocus ?? false,
      crop,
    })
  })

  it('suggests an adapter that keeps autofocus over one that does not', () => {
    const manualFtz: Adapter = { id: 'manual-ftz', adapterFrom: 'nikon-f', adapterTo: 'nikon-z' }
    expect(
      checkCompatibility({ mount: 'nikon-f' }, { mount: 'nikon-z' }, [manualFtz, ftz]),
    ).toEqual({ fit: 'adapter', adapterId: 'ftz', autofocus: true, crop: false })
  })

  it('uses an adapter you own even for a pair that usually needs glass', () => {
    const fdToEf: Adapter = { id: 'fd-ef', adapterFrom: 'canon-fd', adapterTo: 'canon-ef' }
    expect(checkCompatibility({ mount: 'canon-fd' }, { mount: 'canon-ef' }, [fdToEf])).toEqual({
      fit: 'adapter',
      adapterId: 'fd-ef',
      autofocus: false,
      crop: false,
    })
  })

  it('ignores adapters whose mounts are missing or do not match', () => {
    const halfRecorded: Adapter = { id: 'half', adapterFrom: 'nikon-f' }
    const otherWay: Adapter = { id: 'other-way', adapterFrom: 'nikon-z', adapterTo: 'nikon-f' }
    expect(
      checkCompatibility({ mount: 'nikon-f' }, { mount: 'nikon-z' }, [halfRecorded, otherWay]),
    ).toEqual({ fit: 'needs-adapter', crop: false })
  })

  it.each<[string, boolean, Lens, Body]>([
    [
      'an F lens on a Z camera',
      false,
      { mount: 'nikon-f', lensCoverage: 'full-frame' },
      { mount: 'nikon-z', sensorFormat: 'full-frame' },
    ],
    [
      'an EF lens on a Sony E camera',
      false,
      { mount: 'canon-ef', lensCoverage: 'full-frame' },
      { mount: 'sony-e', sensorFormat: 'full-frame' },
    ],
    [
      'an EF-S lens on a full-frame Sony E camera',
      true,
      { mount: 'canon-ef-s', lensCoverage: 'aps-c' },
      { mount: 'sony-e', sensorFormat: 'full-frame' },
    ],
    [
      'a Leica M lens on a Micro Four Thirds camera',
      false,
      { mount: 'leica-m' },
      { mount: 'micro-four-thirds' },
    ],
    ['a Sony E lens on a Nikon Z camera', false, { mount: 'sony-e' }, { mount: 'nikon-z' }],
    ['a Fujifilm X lens on a Nikon Z camera', false, { mount: 'fujifilm-x' }, { mount: 'nikon-z' }],
    ['an M42 lens on a Pentax K camera', false, { mount: 'm42' }, { mount: 'pentax-k' }],
    ['a Pentax K lens on an EF camera', false, { mount: 'pentax-k' }, { mount: 'canon-ef' }],
    [
      'a Canon FD lens on a Fujifilm G camera',
      false,
      { mount: 'canon-fd' },
      { mount: 'fujifilm-g' },
    ],
  ])('needs an adapter for %s, cropping: %s', (_name, crop, lens, body) => {
    expect(checkCompatibility(lens, body, [efToRf])).toEqual({ fit: 'needs-adapter', crop })
  })

  it.each<[string, Lens, Body]>([
    ['an EF-S lens on a full-frame EF camera', { mount: 'canon-ef-s' }, { mount: 'canon-ef' }],
    ['an RF lens on a Sony E camera', { mount: 'canon-rf' }, { mount: 'sony-e' }],
    ['an L-Mount lens on a Sony E camera', { mount: 'l-mount' }, { mount: 'sony-e' }],
    ['an RF lens on an EF-M camera', { mount: 'canon-rf' }, { mount: 'canon-ef-m' }],
    ['a Nikon Z lens on a Canon RF camera', { mount: 'nikon-z' }, { mount: 'canon-rf' }],
    ['a Canon FD lens on an EF camera', { mount: 'canon-fd' }, { mount: 'canon-ef' }],
    ['a Sony A lens on an EF camera', { mount: 'sony-a' }, { mount: 'canon-ef' }],
    ['a Fujifilm G lens on a Sony E camera', { mount: 'fujifilm-g' }, { mount: 'sony-e' }],
    [
      'a Hasselblad XCD lens on a Nikon Z camera',
      { mount: 'hasselblad-xcd' },
      { mount: 'nikon-z' },
    ],
  ])('rules out %s', (_name, lens, body) => {
    expect(checkCompatibility(lens, body, [ftz, efToRf])).toEqual({ fit: 'incompatible' })
  })

  it.each<[string, Lens, Body]>([
    ['the lens', { lensCoverage: 'full-frame' }, { mount: 'sony-e' }],
    ['the camera', { mount: 'sony-e' }, { sensorFormat: 'full-frame' }],
  ])("can't tell without the mount of %s", (_name, lens, body) => {
    expect(checkCompatibility(lens, body, [ftz])).toEqual({ fit: 'unknown' })
  })
})

describe('compatibleGear', () => {
  let ids = 0
  const gear = (fields: Partial<GearFields> & Pick<GearFields, 'category' | 'model'>): Gear => {
    ids += 1
    return {
      id: `g${String(ids)}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      brand: 'Brand',
      status: 'owned',
      ...fields,
    }
  }

  const zLens = gear({
    category: 'lens',
    model: 'Z 24-70mm',
    mount: 'nikon-z',
    lensCoverage: 'full-frame',
  })
  const dxLens = gear({
    category: 'lens',
    model: 'Z DX 16-50mm',
    mount: 'nikon-z',
    lensCoverage: 'aps-c',
  })
  const fLens = gear({ category: 'lens', model: 'AF-S 50mm', mount: 'nikon-f' })
  const z6 = gear({
    category: 'camera-body',
    model: 'Z6 III',
    mount: 'nikon-z',
    sensorFormat: 'full-frame',
  })
  const z50 = gear({
    category: 'camera-body',
    model: 'Z50 II',
    mount: 'nikon-z',
    sensorFormat: 'aps-c',
  })
  const sony = gear({ category: 'camera-body', model: 'A7 IV', mount: 'sony-e' })
  const rf = gear({ category: 'camera-body', model: 'EOS R8', mount: 'canon-rf' })
  const noMount = gear({ category: 'camera-body', model: 'Mystery' })
  const ftzII = gear({
    category: 'mount-adapter',
    model: 'FTZ II',
    adapterFrom: 'nikon-f',
    adapterTo: 'nikon-z',
    adapterAutofocus: true,
  })
  const sold = gear({ category: 'camera-body', model: 'Z5', mount: 'nikon-z', status: 'sold' })
  const wanted = gear({
    category: 'camera-body',
    model: 'Z8',
    mount: 'nikon-z',
    status: 'wishlist',
  })
  const everything = [zLens, dxLens, fLens, z6, z50, sony, rf, noMount, ftzII, sold, wanted]

  const summary = (item: Gear) =>
    compatibleGear(item, everything)?.map(({ gear: other, result }) => [other.model, result])

  it('checks a lens against every body you have, the best fits first', () => {
    expect(summary(fLens)).toEqual([
      ['Z50 II', { fit: 'adapter', adapterId: ftzII.id, autofocus: true, crop: false }],
      ['Z6 III', { fit: 'adapter', adapterId: ftzII.id, autofocus: true, crop: false }],
      ['A7 IV', { fit: 'needs-adapter', crop: false }],
      ['EOS R8', { fit: 'needs-adapter', crop: false }],
      ['Mystery', { fit: 'unknown' }],
    ])
  })

  it('notes when a lens covers a smaller sensor than the body, so it crops', () => {
    expect(summary(dxLens)?.slice(0, 2)).toEqual([
      ['Z50 II', { fit: 'native', crop: false }],
      ['Z6 III', { fit: 'native', crop: true }],
    ])
  })

  it('checks a body against every lens you have', () => {
    expect(summary(z6)).toEqual([
      ['Z 24-70mm', { fit: 'native', crop: false }],
      ['Z DX 16-50mm', { fit: 'native', crop: true }],
      ['AF-S 50mm', { fit: 'adapter', adapterId: ftzII.id, autofocus: true, crop: false }],
    ])
  })

  it('rules out a body nothing can join', () => {
    expect(summary(zLens)?.find(([model]) => model === 'EOS R8')).toEqual([
      'EOS R8',
      { fit: 'incompatible' },
    ])
  })

  it('checks a lens on the wishlist too, against the bodies you have', () => {
    const wantedLens = { ...zLens, id: 'w', status: 'wishlist' as const }
    expect(summary(wantedLens)?.map(([model]) => model)).toContain('Z6 III')
  })

  it.each<[string, Gear]>([
    ['an adapter', ftzII],
    ['a bag', gear({ category: 'bag', model: 'Everyday 20L' })],
  ])('has nothing to check for %s', (_name, item) => {
    expect(compatibleGear(item, everything)).toBeUndefined()
  })
})
