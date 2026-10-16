// The gear catalogue loads as a chunk for each of its data files, so it can grow to thousands of
// models without any one chunk passing the budget for a chunk loaded later. The add and edit pages
// still load it with one import, which brings every chunk in together.

/** The start of every catalogue chunk's name */
const CATALOGUE_CHUNK = 'catalogue'

// A file in src/core/catalogue/data, on any system's paths
const DATA_FILE = /[\\/]src[\\/]core[\\/]catalogue[\\/]data[\\/]([\w-]+)\.ts$/

/**
 * The chunk a module goes in: its own for each maker's catalogue data file, or null to split as
 * usual. The makers' files import nothing at runtime, so their chunks hold only their own data.
 * The index that brings them together imports the schema, so it's left to the usual splitting,
 * rather than pulling the schema's imports into a catalogue chunk.
 */
export function catalogueChunk(moduleId: string): string | null {
  const file = DATA_FILE.exec(moduleId)?.[1]
  if (file === undefined || file === 'index') return null
  return `${CATALOGUE_CHUNK}-${file}`
}

/** A problem for each catalogue chunk among the first-load scripts */
export function catalogueProblems(firstLoad: readonly string[]): string[] {
  return firstLoad
    .filter((file) => file.startsWith(`assets/${CATALOGUE_CHUNK}-`))
    .map(
      (file) =>
        `${file} is in the first load, but the gear catalogue loads only on the add and edit pages.`,
    )
}
