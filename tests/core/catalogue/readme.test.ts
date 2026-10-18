// The README tells photographers how big the gear catalogue is. Each data batch changes the counts,
// so this keeps the sentence in step with the data.
import { expect, it } from 'vitest'
import { CATALOGUE } from '@/core/catalogue/data'
import readme from '../../../README.md?raw'

const COUNTS = /It holds ([\d,]+) camera bodies and ([\d,]+) lenses from ([\d,]+) makers/

it("gives the gear catalogue's counts in the README as they are in the data", () => {
  const [, bodies, lenses, makers] = (COUNTS.exec(readme) ?? []).map((n) =>
    Number(n.replaceAll(',', '')),
  )
  const { entries } = CATALOGUE
  expect({ bodies, lenses, makers }).toEqual({
    bodies: entries.filter(({ category }) => category === 'camera-body').length,
    lenses: entries.filter(({ category }) => category === 'lens').length,
    makers: new Set(entries.map(({ brand }) => brand)).size,
  })
})
