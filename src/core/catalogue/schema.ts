// The gear catalogue: known camera bodies and lenses that can fill in the gear form. The data ships
// with the app and is checked by tests, never parsed at runtime, so this schema is what those tests
// hold it to, and its types are what the data files are written against.
import { z } from 'zod'
import { FILTER_THREAD_RANGE, WEIGHT_RANGE } from '../gear'
import { MOUNTS, SENSOR_FORMATS } from '../mounts'
import { CATALOGUE_ID_MAX_LENGTH, CATALOGUE_ID_PATTERN } from './id'

/** The shape of the data. The data's own version is `version`. */
export const CATALOGUE_FORMAT = 1

const catalogueId = z.string().max(CATALOGUE_ID_MAX_LENGTH).regex(CATALOGUE_ID_PATTERN)

const common = {
  id: catalogueId,
  // The form's own limits
  brand: z.string().min(1).max(80),
  model: z.string().min(1).max(120),
  /** Other names people search by, such as "ILCE-7M4" or "Alpha 7 IV" */
  aliases: z.array(z.string().max(120)).max(8).exactOptional(),
  /** As the maker publishes it: a body with its battery and card, a lens on its own */
  weight: z.int().min(WEIGHT_RANGE.min).max(WEIGHT_RANGE.max).exactOptional(),
}

const bodySchema = z.strictObject({
  ...common,
  category: z.literal('camera-body'),
  mount: z.enum(MOUNTS),
  sensorFormat: z.enum(SENSOR_FORMATS),
})

// The optics rules check the numbers, through the form's own validation in the data tests
const lensSchema = z.strictObject({
  ...common,
  category: z.literal('lens'),
  mount: z.enum(MOUNTS),
  lensCoverage: z.enum(SENSOR_FORMATS),
  focalLengthMin: z.number(),
  focalLengthMax: z.number(),
  maxAperture: z.number(),
  maxApertureTele: z.number().exactOptional(),
  /** Left out for lenses that take no screw-in filters, such as most fisheyes */
  filterThread: z
    .number()
    .min(FILTER_THREAD_RANGE.min)
    .max(FILTER_THREAD_RANGE.max)
    .exactOptional(),
})

export const catalogueEntrySchema = z.discriminatedUnion('category', [bodySchema, lensSchema])

export const catalogueSchema = z.strictObject({
  format: z.literal(CATALOGUE_FORMAT),
  /** The data's own version, such as "2026-10-13", changed with every change to the data */
  version: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(catalogueEntrySchema),
  /** IDs that once existed. An ID is never reused. */
  retired: z.array(catalogueId),
  /** Old ID to new ID, for renamed models */
  renamed: z.record(catalogueId, catalogueId),
})

export type CatalogueEntry = z.infer<typeof catalogueEntrySchema>
export type Catalogue = z.infer<typeof catalogueSchema>
