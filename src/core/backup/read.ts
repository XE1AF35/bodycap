// Reading a backup file someone chose. Nothing in it is trusted: it's parsed, its format is checked
// and upgraded, every field is validated, and each item goes through the same rules as the form.
import { z } from 'zod'
import { addDays } from '../dates'
import { toGearInput, validateGear, type Gear } from '../gear'
import { err, ok, type Result } from '../result'
import { BACKUP_APP, FORMAT_VERSION, type Backup } from './format'
import { migrateBackup } from './migrations'
import { backupSchema } from './schema'

const NOT_A_BACKUP = "This file isn't a Bodycap backup."
const NEWER = 'This backup was made by a newer version of Bodycap. Update Bodycap, then try again.'
const DAMAGED = "This backup is damaged, so it can't be restored."
const INCOMPLETE = "This backup is incomplete, so it can't be restored."
const DUPLICATED = "This backup has the same item twice, so it can't be restored."

// Just enough to tell a Bodycap backup from any other file, before knowing which format it's in
const headerSchema = z.looseObject({ app: z.literal(BACKUP_APP) })
const versionSchema = z.int().min(1)

/** Checks a backup file's text, returning the backup or a plain message about what's wrong. */
export function readBackup(text: string): Result<Backup> {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return err(NOT_A_BACKUP)
  }

  const header = headerSchema.safeParse(json)
  if (!header.success) return err(NOT_A_BACKUP)
  const version = versionSchema.safeParse(header.data.formatVersion)
  if (!version.success) return err(DAMAGED)
  if (version.data > FORMAT_VERSION) return err(NEWER)

  const parsed = backupSchema.safeParse(migrateBackup(header.data, version.data))
  if (!parsed.success) return err(damagedMessage(parsed.error))
  return checkContents(parsed.data)
}

/** Names the item at fault when the damage is inside one */
function damagedMessage(error: z.ZodError): string {
  for (const { path } of error.issues) {
    const [where, list, index] = path
    if (where === 'data' && list === 'gear' && typeof index === 'number') {
      return `Item ${String(index + 1)} in this backup is damaged, so it can't be restored.`
    }
  }
  return DAMAGED
}

/** The checks that need the whole file: counts, repeated IDs, and the gear rules */
function checkContents(file: z.output<typeof backupSchema>): Result<Backup> {
  const { gear } = file.data
  if (file.counts.gear !== gear.length) return err(INCOMPLETE)
  if (new Set(gear.map(({ id }) => id)).size !== gear.length) return err(DUPLICATED)

  // Nothing in a backup can be dated after it was made. Its UTC date plus a day covers the time
  // zones ahead of UTC, where the date had already ticked over.
  const latest = addDays(file.exportedAt.slice(0, 10), 1)
  const checked: Gear[] = []
  for (const [index, item] of gear.entries()) {
    const result = validateGear(toGearInput(item), latest)
    if (!result.ok) {
      const problems = Object.values(result.error).join(' ')
      return err(`Item ${String(index + 1)} in this backup has a problem: ${problems}`)
    }
    const { id, createdAt, updatedAt } = item
    checked.push({ id, createdAt, updatedAt, ...result.value })
  }
  return ok({ ...file, data: { ...file.data, gear: checked } })
}
