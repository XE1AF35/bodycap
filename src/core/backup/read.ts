// Reading a backup file someone chose. Nothing in it is trusted: it's parsed, its format is checked
// and upgraded, every field is validated, each record goes through the same rules as its form, and
// kits, loans, and maintenance may only point at gear in the same file.
import { z } from 'zod'
import { isOneOf } from '../choice'
import { addDays, type IsoDate } from '../dates'
import { toGearInput, validateGear, type Gear } from '../gear'
import { toKitInput, validateKit, type Kit } from '../kits'
import { returnLoan, toLoanInput, validateLoan, type Loan } from '../loans'
import { toMaintenanceInput, validateMaintenance, type MaintenanceRecord } from '../maintenance'
import { DEFAULT_CURRENCY } from '../money'
import { err, ok, type Result } from '../result'
import { BACKUP_APP, FORMAT_VERSION, type Backup, type BackupList } from './format'
import { migrateBackup } from './migrations'
import { backupSchema } from './schema'

const NOT_A_BACKUP = "This file isn't a Bodycap backup."
const NEWER = 'This backup was made by a newer version of Bodycap. Update Bodycap, then try again.'
const DAMAGED = "This backup is damaged, so it can't be restored."
const INCOMPLETE = "This backup is incomplete, so it can't be restored."

// Gear comes first, since the other lists are checked against it
const LISTS = ['gear', 'kits', 'loans', 'maintenance'] as const satisfies readonly BackupList[]

/** How messages name one record in each list */
const RECORD_NAMES: Record<BackupList, string> = {
  gear: 'item',
  kits: 'kit',
  loans: 'loan',
  maintenance: 'maintenance record',
}

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

/** What's wrong with one record, before it's put into words with where the record is */
type RecordProblem =
  | { readonly kind: 'damaged' }
  /** It breaks a rule its form would have caught */
  | { readonly kind: 'rules'; readonly problems: string }
  | { readonly kind: 'missing-gear' }

const breaksRules = (errors: Readonly<Record<string, string | undefined>>): RecordProblem => ({
  kind: 'rules',
  problems: Object.values(errors).join(' '),
})

function describeProblem(list: BackupList, index: number, problem: RecordProblem): string {
  const name = RECORD_NAMES[list]
  const where = `${name.charAt(0).toUpperCase()}${name.slice(1)} ${String(index + 1)} in this backup`
  switch (problem.kind) {
    case 'damaged':
      return `${where} is damaged, so it can't be restored.`
    case 'rules':
      return `${where} has a problem: ${problem.problems}`
    case 'missing-gear': {
      const points = list === 'kits' ? 'lists gear' : 'is for gear'
      return `${where} ${points} that isn't in the backup, so it can't be restored.`
    }
  }
}

/** Names the record at fault when the damage is inside one */
function damagedMessage(error: z.ZodError): string {
  for (const { path } of error.issues) {
    const [where, list, index] = path
    const inRecord = typeof list === 'string' && isOneOf(LISTS, list) && typeof index === 'number'
    if (where === 'data' && inRecord) return describeProblem(list, index, { kind: 'damaged' })
  }
  return DAMAGED
}

/** Checks every record in a list, stopping at the first problem */
function checkEach<T, U>(
  list: BackupList,
  records: readonly T[],
  check: (record: T) => Result<U, RecordProblem>,
): Result<U[]> {
  const checked: U[] = []
  for (const [index, record] of records.entries()) {
    const result = check(record)
    if (!result.ok) return err(describeProblem(list, index, result.error))
    checked.push(result.value)
  }
  return ok(checked)
}

function checkGear(item: Gear, latest: IsoDate): Result<Gear, RecordProblem> {
  const result = validateGear(toGearInput(item), latest)
  if (!result.ok) return err(breaksRules(result.error))
  const { id, createdAt, updatedAt } = item
  return ok({ id, createdAt, updatedAt, ...result.value })
}

function checkKit(kit: Kit, gearIds: ReadonlySet<string>): Result<Kit, RecordProblem> {
  const { id, createdAt, updatedAt, gearIds: inKit, checklist, packedGearIds: packed } = kit
  // The app never makes these, so the file has been changed or broken
  if (
    new Set(inKit).size !== inKit.length ||
    new Set(packed).size !== packed.length ||
    packed.some((gearId) => !inKit.includes(gearId)) ||
    (!checklist && packed.length > 0)
  ) {
    return err({ kind: 'damaged' })
  }
  if (inKit.some((gearId) => !gearIds.has(gearId))) return err({ kind: 'missing-gear' })
  const details = validateKit(toKitInput(kit))
  if (!details.ok) return err(breaksRules(details.error))
  return ok({
    id,
    createdAt,
    updatedAt,
    ...details.value,
    gearIds: inKit,
    checklist,
    packedGearIds: packed,
  })
}

function checkLoan(
  loan: Loan,
  gearIds: ReadonlySet<string>,
  latest: IsoDate,
  /** Gear out on a loan found earlier in the file */
  out: Set<string>,
): Result<Loan, RecordProblem> {
  const { id, createdAt, updatedAt, gearId, returnedOn } = loan
  if (!gearIds.has(gearId)) return err({ kind: 'missing-gear' })
  const details = validateLoan(toLoanInput(loan), latest)
  if (!details.ok) return err(breaksRules(details.error))
  if (returnedOn === undefined) {
    if (out.has(gearId)) {
      return err({ kind: 'rules', problems: 'The item is already out on another loan.' })
    }
    out.add(gearId)
    return ok({ id, createdAt, updatedAt, gearId, ...details.value })
  }
  // Returning it again from scratch applies the same rules as the Returned button
  const returned = returnLoan({ gearId, ...details.value }, returnedOn, latest)
  if (!returned.ok) return err({ kind: 'rules', problems: returned.error })
  return ok({ id, createdAt, updatedAt, ...returned.value })
}

function checkMaintenance(
  record: MaintenanceRecord,
  gearIds: ReadonlySet<string>,
  latest: IsoDate,
): Result<MaintenanceRecord, RecordProblem> {
  const { id, createdAt, updatedAt, gearId } = record
  if (!gearIds.has(gearId)) return err({ kind: 'missing-gear' })
  // The currency only fills a blank cost, which the record doesn't keep
  const details = validateMaintenance(toMaintenanceInput(record, DEFAULT_CURRENCY), latest)
  if (!details.ok) return err(breaksRules(details.error))
  return ok({ id, createdAt, updatedAt, gearId, ...details.value })
}

/** The checks that need the whole file: counts, repeated IDs, each record's rules, and references */
function checkContents(file: z.output<typeof backupSchema>): Result<Backup> {
  const { counts, data } = file
  if (LISTS.some((list) => counts[list] !== data[list].length)) return err(INCOMPLETE)
  for (const list of LISTS) {
    const ids = data[list].map(({ id }) => id)
    if (new Set(ids).size !== ids.length) {
      return err(`This backup has the same ${RECORD_NAMES[list]} twice, so it can't be restored.`)
    }
  }

  // Nothing in a backup can be dated after it was made. Its UTC date plus a day covers the time
  // zones ahead of UTC, where the date had already ticked over.
  const latest = addDays(file.exportedAt.slice(0, 10), 1)
  const gear = checkEach('gear', data.gear, (item) => checkGear(item, latest))
  if (!gear.ok) return gear
  const gearIds = new Set(gear.value.map(({ id }) => id))
  const kits = checkEach('kits', data.kits, (kit) => checkKit(kit, gearIds))
  if (!kits.ok) return kits
  const out = new Set<string>()
  const loans = checkEach('loans', data.loans, (loan) => checkLoan(loan, gearIds, latest, out))
  if (!loans.ok) return loans
  const maintenance = checkEach('maintenance', data.maintenance, (record) =>
    checkMaintenance(record, gearIds, latest),
  )
  if (!maintenance.ok) return maintenance

  return ok({
    ...file,
    data: {
      ...data,
      gear: gear.value,
      kits: kits.value,
      loans: loans.value,
      maintenance: maintenance.value,
    },
  })
}
