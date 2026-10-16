// The catalogue data that ships with the app. Nothing parses it at runtime, so these checks are what
// keep it honest: its shape, unique IDs and names, IDs that stay valid, and every entry filling the
// gear form with values the form accepts exactly as they are. A lens made for several mounts is an
// entry for each mount, so names only need to be unique within a mount.
import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '@/core/catalogue/data'
import { fillFromCatalogue } from '@/core/catalogue/fill'
import { catalogueSchema, type CatalogueEntry } from '@/core/catalogue/schema'
import { emptyGearInput, validateGear } from '@/core/gear'
import { fold } from '@/core/text'
import { A7_IV, ART_35_L_MOUNT, ART_35_SONY_E, FE_50_F18 } from './support'

const TODAY = '2026-10-13'

const duplicates = (values: readonly string[]) =>
  values.filter((value, i) => values.indexOf(value) !== i)

// Names compared as the search sees them: case, accents, and punctuation ignored, but not where
// words break, so "Zf" and "Z f" are different names
const name = (text: string) =>
  fold(text)
    .replaceAll(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** A name within a mount, as each mount's version of a model is listed on its own */
const key = (mount: string, text: string) => `${mount}: ${name(text)}`

/** Brands, models, and mounts listed more than once */
const repeatedModels = (entries: readonly CatalogueEntry[]) =>
  duplicates(entries.map(({ brand, model, mount }) => key(mount, `${brand} ${model}`)))

/** Aliases given to two models of a mount, or that are another model of that mount */
const repeatedAliases = (entries: readonly CatalogueEntry[]) =>
  duplicates(
    entries.flatMap(({ brand, model, mount, aliases = [] }) => [
      key(mount, `${brand} ${model}`),
      ...aliases.map((alias) => key(mount, `${brand} ${alias}`)),
    ]),
  )

/**
 * IDs of models listed for several mounts that don't say which mount they're for. One version may
 * leave its mount out, as an ID listed before the model had other versions never changes.
 */
const idsWithoutMount = (entries: readonly CatalogueEntry[]) => {
  const unsaid = entries.filter(({ id, mount }) => !`-${id}-`.includes(`-${mount}-`))
  const models = unsaid.map(({ brand, model }) => name(`${brand} ${model}`))
  return unsaid.filter((_, i) => duplicates(models).includes(models[i] ?? '')).map(({ id }) => id)
}

describe('the rules for lenses made for several mounts', () => {
  const versions = [ART_35_SONY_E, ART_35_L_MOUNT]

  it('let a model be listed once for each mount', () => {
    expect(repeatedModels([A7_IV, ...versions])).toEqual([])
  })

  it('never let a model be listed twice for one mount', () => {
    const again = {
      ...ART_35_SONY_E,
      id: 'sigma-35mm-f1-4-dg-dn-art-sony-e-2',
      model: '35mm f1.4 DG-DN Art',
    }
    expect(repeatedModels([...versions, again])).toHaveLength(1)
  })

  it('let each version have the same alias, but never another model of its mount', () => {
    const aliased = versions.map((entry) => ({ ...entry, aliases: ['Art 35'] }))
    expect(repeatedAliases(aliased)).toEqual([])
    const clash = { ...FE_50_F18, brand: 'Sigma', aliases: ['35mm F1.4 DG DN Art'] }
    expect(repeatedAliases([...versions, clash])).toHaveLength(1)
    expect(repeatedAliases([...versions, { ...clash, mount: 'nikon-z' }])).toEqual([])
  })

  it('want the mount in the ID of each version', () => {
    expect(idsWithoutMount([A7_IV, ...versions])).toEqual([])
    const unsaid = { ...ART_35_L_MOUNT, id: 'sigma-35mm-f1-4-dg-dn-art' }
    const alsoUnsaid = { ...ART_35_SONY_E, id: 'sigma-35mm-f1-4-dg-dn-art-2' }
    expect(idsWithoutMount([alsoUnsaid, unsaid])).toEqual([alsoUnsaid.id, unsaid.id])
    // A mount's name only counts as whole words of the ID
    const partly = { ...ART_35_L_MOUNT, id: 'sigma-35mm-f1-4-dg-dn-art-l-mounts' }
    expect(idsWithoutMount([alsoUnsaid, partly])).toEqual([alsoUnsaid.id, partly.id])
  })

  it('let the ID listed before a model had other versions stay as it was', () => {
    const older = { ...ART_35_SONY_E, id: 'sigma-35mm-f1-4-dg-dn-art' }
    expect(idsWithoutMount([older, ART_35_L_MOUNT])).toEqual([])
  })
})

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

  it('never lists the same brand, model, and mount twice', () => {
    expect(repeatedModels(entries)).toEqual([])
  })

  it('never gives two models of a mount the same alias, or an alias that is another model', () => {
    expect(repeatedAliases(entries)).toEqual([])
  })

  it('puts the mount in the ID of each later version of a model made for several mounts', () => {
    expect(idsWithoutMount(entries)).toEqual([])
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
