// The catalogue data that ships with the app. Nothing parses it at runtime, so these checks are what
// keep it honest: its shape, unique IDs and names, IDs that stay valid, and every entry filling the
// gear form with values the form accepts exactly as they are.
import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '@/core/catalogue/data'
import { fillFromCatalogue } from '@/core/catalogue/fill'
import { catalogueSchema } from '@/core/catalogue/schema'
import { emptyGearInput, validateGear } from '@/core/gear'
import { fold } from '@/core/text'

const TODAY = '2026-10-13'

const duplicates = (values: readonly string[]) =>
  values.filter((value, i) => values.indexOf(value) !== i)

// Names compared as the search sees them: case, accents, and punctuation ignored, but not where
// words break, so "Zf" and "Z f" are different names
const key = (text: string) =>
  fold(text)
    .replaceAll(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

describe('the catalogue data', () => {
  const { entries } = CATALOGUE

  it('has the catalogue shape', () => {
    expect(catalogueSchema.safeParse(CATALOGUE).error).toBeUndefined()
  })

  it('has camera bodies in it', () => {
    expect(entries.filter(({ category }) => category === 'camera-body').length).toBeGreaterThan(50)
  })

  it('has lenses in it', () => {
    expect(entries.filter(({ category }) => category === 'lens').length).toBeGreaterThan(200)
  })

  it('never uses an ID twice', () => {
    expect(duplicates(entries.map(({ id }) => id))).toEqual([])
  })

  it('never lists the same model twice', () => {
    expect(duplicates(entries.map(({ brand, model }) => key(`${brand} ${model}`)))).toEqual([])
  })

  it('never gives two models the same alias, or an alias that is another model', () => {
    const names = entries.flatMap(({ brand, model, aliases = [] }) => [
      key(`${brand} ${model}`),
      ...aliases.map((alias) => key(`${brand} ${alias}`)),
    ])
    expect(duplicates(names)).toEqual([])
  })

  it('never brings a retired ID back', () => {
    const live = new Set(entries.map(({ id }) => id))
    expect(CATALOGUE.retired.filter((id) => live.has(id))).toEqual([])
  })

  it('renames old IDs to live ones only', () => {
    const live = new Set(entries.map(({ id }) => id))
    for (const [from, to] of Object.entries(CATALOGUE.renamed)) {
      expect(live.has(from), `${from} is still live`).toBe(false)
      expect(live.has(to), `${from} is renamed to ${to}, which is not live`).toBe(true)
    }
  })

  it('fills the gear form with values the form saves exactly as they are', () => {
    for (const entry of entries) {
      const facts = Object.fromEntries(
        Object.entries(entry).filter(([field]) => field !== 'id' && field !== 'aliases'),
      )
      const result = validateGear(fillFromCatalogue(emptyGearInput(), entry), TODAY)
      expect(result, entry.id).toMatchObject({ ok: true, value: facts })
    }
  })
})
