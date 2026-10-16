// The gear catalogue's chunks: one for each maker's data file, and none of them in the first load.
import { describe, expect, it } from 'vitest'
import { catalogueChunk, catalogueProblems } from '../../build/catalogue-chunks'

describe('catalogueChunk', () => {
  it('gives each data file its own chunk, named after it', () => {
    expect(catalogueChunk('/home/me/bodycap/src/core/catalogue/data/sony.ts')).toBe(
      'catalogue-sony',
    )
    expect(catalogueChunk('/home/me/bodycap/src/core/catalogue/data/om-system.ts')).toBe(
      'catalogue-om-system',
    )
  })

  it('leaves the file that brings them together to the usual splitting', () => {
    expect(catalogueChunk('/home/me/bodycap/src/core/catalogue/data/index.ts')).toBeNull()
  })

  it('reads Windows paths too', () => {
    expect(catalogueChunk('C:\\bodycap\\src\\core\\catalogue\\data\\canon.ts')).toBe(
      'catalogue-canon',
    )
  })

  it('leaves everything else to the usual splitting', () => {
    expect(catalogueChunk('/home/me/bodycap/src/core/catalogue/search.ts')).toBeNull()
    expect(catalogueChunk('/home/me/bodycap/src/core/catalogue/data.ts')).toBeNull()
    expect(catalogueChunk('/home/me/bodycap/node_modules/zod/index.js')).toBeNull()
    expect(catalogueChunk('/home/me/bodycap/src/core/catalogue/data/notes.md')).toBeNull()
  })
})

describe('catalogueProblems', () => {
  it('names any catalogue chunk in the first load', () => {
    const firstLoad = [
      'assets/index-abc.js',
      'assets/catalogue-sony-def.js',
      'assets/catalogue-canon-ghi.js',
    ]
    expect(catalogueProblems(firstLoad)).toEqual([
      'assets/catalogue-sony-def.js is in the first load, but the gear catalogue loads only on the add and edit pages.',
      'assets/catalogue-canon-ghi.js is in the first load, but the gear catalogue loads only on the add and edit pages.',
    ])
  })

  it('finds nothing wrong when the catalogue loads later', () => {
    expect(
      catalogueProblems(['theme-init.js', 'assets/index-abc.js', 'assets/Page-def.js']),
    ).toEqual([])
  })
})
