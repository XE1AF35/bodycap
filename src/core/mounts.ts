// Lens mounts and sensor formats that gear can refer to. Records store these IDs, never the labels,
// so the wording can change without touching saved data or backups.

export const MOUNTS = [
  'canon-ef',
  'canon-ef-s',
  'canon-ef-m',
  'canon-rf',
  'nikon-f',
  'nikon-z',
  'sony-a',
  'sony-e',
  'fujifilm-x',
  'fujifilm-g',
  'micro-four-thirds',
  'l-mount',
  'pentax-k',
  'leica-m',
  'hasselblad-xcd',
  'm42',
  'canon-fd',
] as const

export type MountId = (typeof MOUNTS)[number]

export const MOUNT_LABELS: Record<MountId, string> = {
  'canon-ef': 'Canon EF',
  'canon-ef-s': 'Canon EF-S',
  'canon-ef-m': 'Canon EF-M',
  'canon-rf': 'Canon RF (including RF-S)',
  'nikon-f': 'Nikon F',
  'nikon-z': 'Nikon Z',
  'sony-a': 'Sony A',
  'sony-e': 'Sony E (including FE)',
  'fujifilm-x': 'Fujifilm X',
  'fujifilm-g': 'Fujifilm G (GFX)',
  'micro-four-thirds': 'Micro Four Thirds',
  'l-mount': 'L-Mount',
  'pentax-k': 'Pentax K',
  'leica-m': 'Leica M',
  'hasselblad-xcd': 'Hasselblad XCD',
  m42: 'M42',
  'canon-fd': 'Canon FD',
}

/** Sensor sizes, from largest to smallest: a body's sensor, or the image circle a lens covers */
export const SENSOR_FORMATS = ['medium-format', 'full-frame', 'aps-c', 'micro-four-thirds'] as const

export type SensorFormat = (typeof SENSOR_FORMATS)[number]

export const SENSOR_FORMAT_LABELS: Record<SensorFormat, string> = {
  'medium-format': 'Medium format',
  'full-frame': 'Full frame',
  'aps-c': 'APS-C',
  'micro-four-thirds': 'Micro Four Thirds',
}
