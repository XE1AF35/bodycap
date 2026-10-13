// A small catalogue for tests: one body, one prime, and one zoom that opens less wide at the long end.
import { CATALOGUE_FORMAT, type Catalogue, type CatalogueEntry } from '@/core/catalogue/schema'

export const A7_IV = {
  id: 'sony-a7-iv',
  brand: 'Sony',
  model: 'a7 IV',
  aliases: ['ILCE-7M4', 'Alpha 7 IV'],
  category: 'camera-body',
  mount: 'sony-e',
  sensorFormat: 'full-frame',
} as const satisfies CatalogueEntry

export const FE_50_F18 = {
  id: 'sony-fe-50mm-f1-8',
  brand: 'Sony',
  model: 'FE 50mm F1.8',
  category: 'lens',
  mount: 'sony-e',
  lensCoverage: 'full-frame',
  focalLengthMin: 50,
  focalLengthMax: 50,
  maxAperture: 1.8,
} as const satisfies CatalogueEntry

export const FE_28_70 = {
  id: 'sony-fe-28-70mm-f3-5-5-6-oss',
  brand: 'Sony',
  model: 'FE 28-70mm F3.5-5.6 OSS',
  aliases: ['SEL2870'],
  category: 'lens',
  mount: 'sony-e',
  lensCoverage: 'full-frame',
  focalLengthMin: 28,
  focalLengthMax: 70,
  maxAperture: 3.5,
  maxApertureTele: 5.6,
} as const satisfies CatalogueEntry

export const CATALOGUE = {
  format: CATALOGUE_FORMAT,
  version: '2026-10-13',
  entries: [A7_IV, FE_50_F18, FE_28_70],
  retired: ['sony-a7-iii-old'],
  renamed: { 'sony-alpha-7-iv': 'sony-a7-iv' },
} as const satisfies Catalogue
