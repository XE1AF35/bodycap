// Catalogue IDs: lower-case words joined by single hyphens, such as sony-a7-iv. Items keep the ID
// they were filled from, so an ID is never reused for a different model.

export const CATALOGUE_ID_MAX_LENGTH = 80

export const CATALOGUE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Whether `value` is shaped like a catalogue ID. It may still name no model the catalogue has. */
export function isCatalogueId(value: string): boolean {
  return value.length <= CATALOGUE_ID_MAX_LENGTH && CATALOGUE_ID_PATTERN.test(value)
}
