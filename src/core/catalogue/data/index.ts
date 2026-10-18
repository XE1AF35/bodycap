// The gear catalogue that ships with the app, loaded only on the add and edit pages. Each maker
// has its own file. Change `version` with every change to the data, and never reuse an ID: a
// removed model goes in `retired`, and a renamed one in `renamed`.
import { CATALOGUE_FORMAT, type Catalogue } from '../schema'
import { SONY_A_BODIES, SONY_A_LENSES, SONY_BODIES, SONY_LENSES } from './sony'
import { CANON_BODIES, CANON_DSLR_BODIES, CANON_DSLR_LENSES, CANON_LENSES } from './canon'
import { NIKON_BODIES, NIKON_DSLR_BODIES, NIKON_DSLR_LENSES, NIKON_LENSES } from './nikon'
import { FUJIFILM_BODIES, FUJIFILM_LENSES } from './fujifilm'
import { PANASONIC_BODIES, PANASONIC_LENSES } from './panasonic'
import { LEICA_BODIES } from './leica'
import { SIGMA_BODIES, SIGMA_LENSES } from './sigma'
import { TAMRON_LENSES } from './tamron'
import { SAMYANG_LENSES } from './samyang'
import { TOKINA_LENSES } from './tokina'
import { VILTROX_LENSES } from './viltrox'
import { LAOWA_LENSES } from './laowa'
import { ZEISS_LENSES } from './zeiss'
import { VOIGTLANDER_LENSES } from './voigtlander'
import { TTARTISAN_LENSES } from './ttartisan'
import { OLYMPUS_BODIES, OLYMPUS_LENSES } from './olympus'
import { OM_SYSTEM_BODIES, OM_SYSTEM_LENSES } from './om-system'
import { HASSELBLAD_BODIES } from './hasselblad'
import { PENTAX_BODIES, PENTAX_LENSES } from './pentax'
import { KODAK_BODIES } from './kodak'
import { YI_BODIES } from './yi'
import { SAMSUNG_BODIES } from './samsung'

export const CATALOGUE: Catalogue = {
  format: CATALOGUE_FORMAT,
  version: '2026-10-18',
  entries: [
    ...SONY_BODIES,
    ...SONY_LENSES,
    ...SONY_A_BODIES,
    ...SONY_A_LENSES,
    ...CANON_BODIES,
    ...CANON_LENSES,
    ...CANON_DSLR_BODIES,
    ...CANON_DSLR_LENSES,
    ...NIKON_BODIES,
    ...NIKON_LENSES,
    ...NIKON_DSLR_BODIES,
    ...NIKON_DSLR_LENSES,
    ...FUJIFILM_BODIES,
    ...FUJIFILM_LENSES,
    ...PANASONIC_BODIES,
    ...PANASONIC_LENSES,
    ...LEICA_BODIES,
    ...SIGMA_BODIES,
    ...SIGMA_LENSES,
    ...TAMRON_LENSES,
    ...SAMYANG_LENSES,
    ...TOKINA_LENSES,
    ...VILTROX_LENSES,
    ...LAOWA_LENSES,
    ...ZEISS_LENSES,
    ...VOIGTLANDER_LENSES,
    ...TTARTISAN_LENSES,
    ...OLYMPUS_BODIES,
    ...OLYMPUS_LENSES,
    ...OM_SYSTEM_BODIES,
    ...OM_SYSTEM_LENSES,
    ...HASSELBLAD_BODIES,
    ...PENTAX_BODIES,
    ...PENTAX_LENSES,
    ...KODAK_BODIES,
    ...YI_BODIES,
    ...SAMSUNG_BODIES,
  ],
  retired: [],
  renamed: {},
}
