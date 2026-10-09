// Merging a backup into what's here, rather than replacing it. Each record is matched by its ID,
// and whichever copy changed last wins, whichever side it's on. Records only one side has are
// kept. Deletions aren't recorded, so something deleted here but still in the backup comes back.
import { coverChanges, type PhotoInfo } from '../photos'
import { err, ok, type Result } from '../result'
import type { BackupData, BackupList, BackupSettings } from './format'

export interface MergePlan {
  /** What to save: records only the backup has, and backup copies that changed later */
  readonly writes: Pick<BackupData, BackupList>
  readonly added: Readonly<Record<BackupList, number>>
  readonly updated: Readonly<Record<BackupList, number>>
  /** Photos here that stop or start being their item's cover, so each item keeps exactly one */
  readonly coverChanges: readonly Pick<PhotoInfo, 'id' | 'isCover'>[]
  readonly settings: BackupSettings
}

interface Stamped {
  readonly id: string
  /** ISO 8601 UTC */
  readonly updatedAt: string
}

// Compared as times, since text would sort 03:00:00Z after 03:00:00.500Z
const time = (record: Stamped) => Date.parse(record.updatedAt)

/** The records to write from one list, and how many of them are new */
function mergeList<T extends Stamped>(here: readonly T[], incoming: readonly T[]) {
  const ours = new Map(here.map((record) => [record.id, record]))
  const writes: T[] = []
  let added = 0
  for (const theirs of incoming) {
    const mine = ours.get(theirs.id)
    if (mine === undefined) added += 1
    // A tie keeps what's here, so merging the same backup twice changes nothing
    else if (time(theirs) <= time(mine)) continue
    writes.push(theirs)
  }
  return { writes, added, updated: writes.length - added }
}

/**
 * Photos from both sides can give an item two covers. The oldest stays the cover, as it would in
 * the app, so the backup's photos are written with their covers settled, and photos here that
 * change are listed apart, since only their cover changes.
 */
function settleCovers(here: readonly PhotoInfo[], writes: readonly PhotoInfo[]) {
  const together = new Map([...here, ...writes].map((photo) => [photo.id, photo]))
  const settled = new Map(coverChanges([...together.values()]).map((photo) => [photo.id, photo]))
  const written = new Set(writes.map(({ id }) => id))
  return {
    writes: writes.map((photo) => settled.get(photo.id) ?? photo),
    changesHere: [...settled.values()]
      .filter(({ id }) => !written.has(id))
      .map(({ id, isCover }) => ({ id, isCover })),
  }
}

/** Works out a merge, or says why these two can't be merged */
export function planMerge(here: BackupData, incoming: BackupData): Result<MergePlan> {
  const gear = mergeList(here.gear, incoming.gear)
  const kits = mergeList(here.kits, incoming.kits)
  const loans = mergeList(here.loans, incoming.loans)
  const maintenance = mergeList(here.maintenance, incoming.maintenance)
  const photos = mergeList(here.photos, incoming.photos)

  // Each side has at most one loan out per item, but different loans from each side would leave an
  // item out twice. Which one is right can't be told from the data, so the person decides.
  const merged = new Map([...here.loans, ...loans.writes].map((loan) => [loan.id, loan]))
  const out = new Set<string>()
  for (const loan of merged.values()) {
    if (loan.returnedOn !== undefined) continue
    if (out.has(loan.gearId)) {
      const item = [...incoming.gear, ...here.gear].find(({ id }) => id === loan.gearId)
      const name = item === undefined ? 'An item' : `${item.brand} ${item.model}`
      return err(
        `${name} is out on a loan here and a different one in the backup, so they can't be merged. Mark one of them as returned, then try again.`,
      )
    }
    out.add(loan.gearId)
  }

  const covers = settleCovers(here.photos, photos.writes)
  const lastUsedCurrency = here.settings.lastUsedCurrency ?? incoming.settings.lastUsedCurrency
  return ok({
    writes: {
      gear: gear.writes,
      kits: kits.writes,
      loans: loans.writes,
      maintenance: maintenance.writes,
      photos: covers.writes,
    },
    added: {
      gear: gear.added,
      kits: kits.added,
      loans: loans.added,
      maintenance: maintenance.added,
      photos: photos.added,
    },
    updated: {
      gear: gear.updated,
      kits: kits.updated,
      loans: loans.updated,
      maintenance: maintenance.updated,
      photos: photos.updated,
    },
    coverChanges: covers.changesHere,
    settings: lastUsedCurrency === undefined ? {} : { lastUsedCurrency },
  })
}
