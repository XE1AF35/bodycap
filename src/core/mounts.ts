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

/** The short names engraved on gear and used in shops, for badges where the full name won't fit */
export const MOUNT_CODES: Record<MountId, string> = {
  'canon-ef': 'EF',
  'canon-ef-s': 'EF-S',
  'canon-ef-m': 'EF-M',
  'canon-rf': 'RF',
  'nikon-f': 'F',
  'nikon-z': 'Z',
  'sony-a': 'A',
  'sony-e': 'E',
  'fujifilm-x': 'X',
  'fujifilm-g': 'G',
  'micro-four-thirds': 'MFT',
  'l-mount': 'L',
  'pentax-k': 'K',
  'leica-m': 'M',
  'hasselblad-xcd': 'XCD',
  m42: 'M42',
  'canon-fd': 'FD',
}

/** Millimetres from the mount to the sensor, as the makers publish them */
export const FLANGE_MM: Record<MountId, number> = {
  'canon-ef': 44,
  'canon-ef-s': 44,
  'canon-ef-m': 18,
  'canon-rf': 20,
  'nikon-f': 46.5,
  'nikon-z': 16,
  'sony-a': 44.5,
  'sony-e': 18,
  'fujifilm-x': 17.7,
  'fujifilm-g': 26.7,
  'micro-four-thirds': 19.25,
  'l-mount': 20,
  'pentax-k': 45.46,
  'leica-m': 27.8,
  'hasselblad-xcd': 18.14,
  m42: 45.46,
  'canon-fd': 42,
}

// An EF-S lens would hit the mirror of a full-frame EF camera, so only EF-S cameras take both
const ALSO_TAKES: Partial<Record<MountId, readonly MountId[]>> = {
  'canon-ef-s': ['canon-ef'],
}

/** Whether a lens goes straight onto a camera, with no adapter. */
export function fitsNatively(lens: MountId, camera: MountId): boolean {
  return lens === camera || (ALSO_TAKES[camera]?.includes(lens) ?? false)
}

const MIRRORLESS: readonly MountId[] = [
  'canon-ef-m',
  'canon-rf',
  'nikon-z',
  'sony-e',
  'fujifilm-x',
  'fujifilm-g',
  'micro-four-thirds',
  'l-mount',
  'hasselblad-xcd',
]

// An SLR lens sits far enough forward for an adapter to any mirrorless camera, Leica M included
const FROM_SLR: readonly MountId[] = [...MIRRORLESS, 'leica-m']

/**
 * The cameras each lens mount can go on through a plain adapter, with no glass in it. Flange
 * distance alone doesn't decide this: an RF lens sits 2 mm further out than Sony E needs, but it's
 * too wide to fit, so the pairs are listed as the adapters actually exist.
 */
export const ADAPTS_TO: Record<MountId, readonly MountId[]> = {
  'canon-ef': FROM_SLR,
  'canon-ef-s': FROM_SLR,
  'canon-ef-m': [],
  'canon-rf': [],
  'nikon-f': [...FROM_SLR, 'canon-ef', 'canon-ef-s', 'sony-a'],
  'nikon-z': [],
  'sony-a': FROM_SLR,
  'sony-e': ['nikon-z'],
  'fujifilm-x': ['nikon-z'],
  'fujifilm-g': [],
  'micro-four-thirds': [],
  'l-mount': [],
  'pentax-k': [...FROM_SLR, 'canon-ef', 'canon-ef-s'],
  'leica-m': MIRRORLESS,
  'hasselblad-xcd': [],
  m42: [...FROM_SLR, 'canon-ef', 'canon-ef-s', 'pentax-k'],
  'canon-fd': FROM_SLR,
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
