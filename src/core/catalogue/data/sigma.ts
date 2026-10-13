// Sigma L-Mount camera bodies. Names, mounts, and sensor formats as Sigma publishes them,
// cross-checked against reference lists and launch coverage.
import type { CatalogueEntry } from '../schema'

export const SIGMA_BODIES: readonly CatalogueEntry[] = [
  {
    id: 'sigma-fp',
    brand: 'Sigma',
    model: 'fp',
    category: 'camera-body',
    mount: 'l-mount',
    sensorFormat: 'full-frame',
  },
  {
    id: 'sigma-fp-l',
    brand: 'Sigma',
    model: 'fp L',
    category: 'camera-body',
    mount: 'l-mount',
    sensorFormat: 'full-frame',
  },
  {
    id: 'sigma-bf',
    brand: 'Sigma',
    model: 'BF',
    category: 'camera-body',
    mount: 'l-mount',
    sensorFormat: 'full-frame',
  },
]
