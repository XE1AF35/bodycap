// Stats for the dashboard, from what's already kept: bodies and lenses by mount, how old gear is,
// the warranties still running, and how much gear is in kits. Only gear you have counts: owned,
// lent out, or in repair. (Value by category is in value.ts, with the other totals.)
import { daysBetween, type IsoDate } from './dates'
import { isHeld, type Gear } from './gear'
import { kitGear, type Kit } from './kits'
import { LOCALE } from './locale'
import { MOUNT_LABELS, type MountId } from './mounts'

const collator = new Intl.Collator(LOCALE, { numeric: true })

export interface MountCount {
  readonly mount: MountId
  readonly count: number
}

export interface MountShare {
  /** Most first, then by the mount's name */
  readonly mounts: readonly MountCount[]
  /** Bodies and lenses with no mount recorded */
  readonly unrecorded: number
  /** Every body and lens counted, with a mount or without */
  readonly total: number
}

/** The bodies and lenses you have, by mount. Adapters have two mounts, so they're left out. */
export function mountShare(items: readonly Gear[]): MountShare {
  const counts = new Map<MountId, number>()
  let unrecorded = 0
  let total = 0
  for (const { category, mount, status } of items) {
    if ((category !== 'camera-body' && category !== 'lens') || !isHeld(status)) continue
    total += 1
    if (mount === undefined) unrecorded += 1
    else counts.set(mount, (counts.get(mount) ?? 0) + 1)
  }
  const mounts = [...counts].map(([mount, count]) => ({ mount, count }))
  mounts.sort(
    (a, b) => b.count - a.count || collator.compare(MOUNT_LABELS[a.mount], MOUNT_LABELS[b.mount]),
  )
  return { mounts, unrecorded, total }
}

/** Whole years since a purchase, as birthdays count them */
function wholeYears(from: IsoDate, to: IsoDate): number {
  // YYYY-MM-DD, so the month and day compare as text
  const beforeAnniversary = to.slice(5) < from.slice(5)
  return Number(to.slice(0, 4)) - Number(from.slice(0, 4)) - (beforeAnniversary ? 1 : 0)
}

/** How long ago gear was bought, in whole years, from youngest to oldest */
export const AGE_BANDS = ['under-1', '1-2', '3-5', '6-10', 'over-10'] as const

export type AgeBand = (typeof AGE_BANDS)[number]

function bandFor(years: number): AgeBand {
  if (years < 1) return 'under-1'
  if (years <= 2) return '1-2'
  if (years <= 5) return '3-5'
  if (years <= 10) return '6-10'
  return 'over-10'
}

export interface GearAge {
  /** Every band, in order, even those with nothing in them */
  readonly bands: readonly { readonly band: AgeBand; readonly count: number }[]
  /** Gear with no purchase date */
  readonly unrecorded: number
}

export function gearAge(items: readonly Gear[], today: IsoDate): GearAge {
  const counts = new Map<AgeBand, number>()
  let unrecorded = 0
  for (const { purchaseDate, status } of items) {
    if (!isHeld(status)) continue
    if (purchaseDate === undefined) {
      unrecorded += 1
      continue
    }
    const band = bandFor(wholeYears(purchaseDate, today))
    counts.set(band, (counts.get(band) ?? 0) + 1)
  }
  return { bands: AGE_BANDS.map((band) => ({ band, count: counts.get(band) ?? 0 })), unrecorded }
}

export interface RunningWarranty {
  readonly item: Gear
  readonly warrantyExpiry: IsoDate
  /** 0 on the last day of cover */
  readonly daysLeft: number
}

export interface WarrantyTimeline {
  /** Soonest to end first */
  readonly running: readonly RunningWarranty[]
  readonly ended: number
}

export function warrantyTimeline(items: readonly Gear[], today: IsoDate): WarrantyTimeline {
  const running: RunningWarranty[] = []
  let ended = 0
  for (const item of items) {
    const { warrantyExpiry, status } = item
    if (warrantyExpiry === undefined || !isHeld(status)) continue
    const daysLeft = daysBetween(today, warrantyExpiry)
    if (daysLeft < 0) ended += 1
    else running.push({ item, warrantyExpiry, daysLeft })
  }
  running.sort((a, b) => a.daysLeft - b.daysLeft)
  return { running, ended }
}

export interface GearInKits {
  /** Each kit by name, with how many of its items you have */
  readonly kits: readonly { readonly kit: Kit; readonly count: number }[]
  /** Items you have that are in at least one kit, each counted once */
  readonly inKits: number
  /** Every item you have */
  readonly total: number
}

export function gearInKits(kits: readonly Kit[], items: readonly Gear[]): GearInKits {
  const held = items.filter(({ status }) => isHeld(status))
  const inAny = new Set<string>()
  const counted = kits.map((kit) => {
    const gear = kitGear(kit, held)
    for (const { id } of gear) inAny.add(id)
    return { kit, count: gear.length }
  })
  counted.sort((a, b) => collator.compare(a.kit.name, b.kit.name))
  return { kits: counted, inKits: inAny.size, total: held.length }
}
