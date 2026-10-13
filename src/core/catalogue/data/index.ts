// The gear catalogue that ships with the app, loaded only on the add and edit pages. Each maker
// has its own file. Change `version` with every change to the data, and never reuse an ID: a
// removed model goes in `retired`, and a renamed one in `renamed`.
import { CATALOGUE_FORMAT, type Catalogue } from '../schema'
import { SONY_BODIES, SONY_LENSES } from './sony'
import { CANON_BODIES, CANON_LENSES } from './canon'
import { NIKON_BODIES, NIKON_LENSES } from './nikon'
import { FUJIFILM_BODIES, FUJIFILM_LENSES } from './fujifilm'
import { PANASONIC_BODIES, PANASONIC_LENSES } from './panasonic'
import { LEICA_BODIES } from './leica'
import { SIGMA_BODIES } from './sigma'
import { OLYMPUS_BODIES, OLYMPUS_LENSES } from './olympus'
import { OM_SYSTEM_BODIES, OM_SYSTEM_LENSES } from './om-system'
import { HASSELBLAD_BODIES } from './hasselblad'

export const CATALOGUE: Catalogue = {
  format: CATALOGUE_FORMAT,
  version: '2026-10-13',
  entries: [
    ...SONY_BODIES,
    ...SONY_LENSES,
    ...CANON_BODIES,
    ...CANON_LENSES,
    ...NIKON_BODIES,
    ...NIKON_LENSES,
    ...FUJIFILM_BODIES,
    ...FUJIFILM_LENSES,
    ...PANASONIC_BODIES,
    ...PANASONIC_LENSES,
    ...LEICA_BODIES,
    ...SIGMA_BODIES,
    ...OLYMPUS_BODIES,
    ...OLYMPUS_LENSES,
    ...OM_SYSTEM_BODIES,
    ...OM_SYSTEM_LENSES,
    ...HASSELBLAD_BODIES,
  ],
  retired: [],
  renamed: {},
}
