// The gear catalogue that ships with the app, loaded only on the add and edit pages. Each maker
// has its own file. Change `version` with every change to the data, and never reuse an ID: a
// removed model goes in `retired`, and a renamed one in `renamed`.
import { CATALOGUE_FORMAT, type Catalogue } from '../schema'
import { SONY_BODIES } from './sony'
import { CANON_BODIES } from './canon'
import { NIKON_BODIES } from './nikon'
import { FUJIFILM_BODIES } from './fujifilm'
import { PANASONIC_BODIES } from './panasonic'
import { LEICA_BODIES } from './leica'
import { SIGMA_BODIES } from './sigma'
import { OLYMPUS_BODIES } from './olympus'
import { OM_SYSTEM_BODIES } from './om-system'
import { HASSELBLAD_BODIES } from './hasselblad'

export const CATALOGUE: Catalogue = {
  format: CATALOGUE_FORMAT,
  version: '2026-10-13',
  entries: [
    ...SONY_BODIES,
    ...CANON_BODIES,
    ...NIKON_BODIES,
    ...FUJIFILM_BODIES,
    ...PANASONIC_BODIES,
    ...LEICA_BODIES,
    ...SIGMA_BODIES,
    ...OLYMPUS_BODIES,
    ...OM_SYSTEM_BODIES,
    ...HASSELBLAD_BODIES,
  ],
  retired: [],
  renamed: {},
}
