// Pentax K-mount camera bodies. Names, mounts, and sensor formats as Pentax publishes them,
// cross-checked against reference lists and launch coverage.
import type { CatalogueEntry } from '../schema'

export const PENTAX_BODIES: readonly CatalogueEntry[] = [
  // The K-01 is mirrorless, but takes K-mount lenses with no adapter
  {
    id: 'pentax-k-01',
    brand: 'Pentax',
    model: 'K-01',
    category: 'camera-body',
    mount: 'pentax-k',
    sensorFormat: 'aps-c',
  },
]
