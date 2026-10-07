// How a lens and a camera work together, in words, and a dot that only helps the eye. Shared by the
// compatibility panel and the system map.
import type { Compatibility } from '@/core/compatibility'
import type { Gear } from '@/core/gear'
import { SENSOR_FORMAT_LABELS } from '@/core/mounts'
import { gearName } from '@/ui/gear/labels'

// Filled when it fits as it is, an outline with an adapter, and faint when it won't work as is
export const FIT_DOTS: Record<Compatibility['fit'], string> = {
  native: 'bg-foreground',
  adapter: 'border border-foreground',
  'needs-adapter': 'border border-muted-foreground',
  incompatible: 'bg-muted-foreground/40',
  unknown: 'bg-muted-foreground/40',
}

/** How a lens and a body work together, in words */
export function describeFit(
  result: Compatibility,
  lens: Gear,
  adapters: ReadonlyMap<string, Gear>,
): string {
  const coverage = lens.lensCoverage
  const crop = coverage === undefined ? '' : `, cropped to ${SENSOR_FORMAT_LABELS[coverage]}`
  switch (result.fit) {
    case 'native':
      return `Fits${result.crop ? crop : ''}`
    case 'adapter': {
      const adapter = adapters.get(result.adapterId)
      const through = adapter === undefined ? 'With your adapter' : `With your ${gearName(adapter)}`
      return `${through}${result.autofocus ? '' : ', manual focus only'}${result.crop ? crop : ''}`
    }
    case 'needs-adapter':
      return 'Needs an adapter'
    case 'incompatible':
      return "Doesn't fit"
    case 'unknown':
      return 'Mount not recorded'
  }
}
