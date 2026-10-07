// Kits: named collections of gear, such as "Wedding" or "Travel light". A kit can also be a packing
// list, with each item ticked off as it goes in the bag. Ticks only exist while the checklist is
// on, and only for gear in the kit, so every change here keeps that true.
import { fieldErrors, readText } from './fields'
import { err, ok, type Result } from './result'

export interface KitFields {
  readonly name: string
  readonly description?: string
  /** The kit's gear, in the order it was added */
  readonly gearIds: readonly string[]
  /** Whether the kit is used as a packing list */
  readonly checklist: boolean
  /** The gear ticked as packed: always in the kit, and none while the checklist is off */
  readonly packedGearIds: readonly string[]
}

export interface Kit extends KitFields {
  readonly id: string
  /** ISO 8601 UTC timestamps */
  readonly createdAt: string
  readonly updatedAt: string
}

/** What the kit form decides; the gear and ticks change from the kit's own page */
export type KitDetails = Pick<KitFields, 'name' | 'description'>

/** What the kit form holds, as typed */
export interface KitInput {
  readonly name: string
  readonly description: string
}

export type KitErrors = Partial<Record<keyof KitInput, string>>

/** Checks a kit's name and description as typed. All problems are reported together. */
export function validateKit(input: KitInput): Result<KitDetails, KitErrors> {
  const { errors, take } = fieldErrors<keyof KitInput>()
  const name = take('name', readText(input.name, { max: 80, name: 'the name' }))
  if (name === undefined) errors.name ??= 'Enter a name for the kit.'
  const description = take(
    'description',
    readText(input.description, { max: 1000, name: 'the description', multiline: true }),
  )
  if (name === undefined || Object.keys(errors).length > 0) return err(errors)
  return ok({ name, ...(description !== undefined ? { description } : {}) })
}

/** Fills the kit form from a saved kit */
export function toKitInput(kit: KitDetails): KitInput {
  return { name: kit.name, description: kit.description ?? '' }
}

/** A kit with a new name and description, keeping its gear and ticks. A cleared description goes. */
export function withDetails(kit: KitFields, { name, description }: KitDetails): KitFields {
  const { gearIds, checklist, packedGearIds } = kit
  return {
    name,
    ...(description === undefined ? {} : { description }),
    gearIds,
    checklist,
    packedGearIds,
  }
}

/** A new kit: empty, and a plain collection until its checklist is turned on */
export function newKit(details: KitDetails): KitFields {
  return { ...details, gearIds: [], checklist: false, packedGearIds: [] }
}

/** Adds gear to the end of a kit, skipping anything already in it */
export function addToKit<T extends KitFields>(kit: T, gearIds: readonly string[]): T {
  return { ...kit, gearIds: [...new Set([...kit.gearIds, ...gearIds])] }
}

/** Takes an item out of a kit, and off its packing list */
export function removeFromKit<T extends KitFields>(kit: T, gearId: string): T {
  return {
    ...kit,
    gearIds: kit.gearIds.filter((id) => id !== gearId),
    packedGearIds: kit.packedGearIds.filter((id) => id !== gearId),
  }
}

/** Turns the packing checklist on or off. Turning it off forgets what was ticked. */
export function setChecklist<T extends KitFields>(kit: T, on: boolean): T {
  return { ...kit, checklist: on, packedGearIds: on ? kit.packedGearIds : [] }
}

/** Ticks an item as packed, or unticks it. Nothing changes unless the checklist is on and the item is in the kit. */
export function setPacked<T extends KitFields>(kit: T, gearId: string, packed: boolean): T {
  if (!kit.checklist || !kit.gearIds.includes(gearId)) return kit
  const others = kit.packedGearIds.filter((id) => id !== gearId)
  return { ...kit, packedGearIds: packed ? [...others, gearId] : others }
}

/** Unticks everything, ready to pack again */
export function resetPacking<T extends KitFields>(kit: T): T {
  return { ...kit, packedGearIds: [] }
}

/** How much of the kit is packed, or nothing while the checklist is off */
export function packingProgress(
  kit: KitFields,
): { readonly packed: number; readonly total: number } | undefined {
  if (!kit.checklist) return undefined
  return { packed: kit.packedGearIds.length, total: kit.gearIds.length }
}

/** The kit's gear in the kit's order, leaving out anything no longer there */
export function kitGear<G extends { readonly id: string }>(
  kit: KitFields,
  gear: readonly G[],
): G[] {
  const byId = new Map(gear.map((item) => [item.id, item]))
  return kit.gearIds.flatMap((id) => byId.get(id) ?? [])
}
