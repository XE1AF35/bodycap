// Hasselblad XCD camera bodies. Names, mounts, and sensor formats as Hasselblad publishes them,
// cross-checked against reference lists and launch coverage.
import type { CatalogueEntry } from '../schema'

export const HASSELBLAD_BODIES: readonly CatalogueEntry[] = [
  {
    id: 'hasselblad-907x-50c',
    brand: 'Hasselblad',
    model: '907X 50C',
    category: 'camera-body',
    mount: 'hasselblad-xcd',
    sensorFormat: 'medium-format',
  },
  {
    id: 'hasselblad-x1d-ii-50c',
    brand: 'Hasselblad',
    model: 'X1D II 50C',
    category: 'camera-body',
    mount: 'hasselblad-xcd',
    sensorFormat: 'medium-format',
  },
  {
    id: 'hasselblad-x2d-100c',
    brand: 'Hasselblad',
    model: 'X2D 100C',
    category: 'camera-body',
    mount: 'hasselblad-xcd',
    sensorFormat: 'medium-format',
  },
  {
    id: 'hasselblad-x2d-ii-100c',
    brand: 'Hasselblad',
    model: 'X2D II 100C',
    category: 'camera-body',
    mount: 'hasselblad-xcd',
    sensorFormat: 'medium-format',
  },
]
