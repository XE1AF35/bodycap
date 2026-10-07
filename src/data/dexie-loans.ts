// The loan repository, on Dexie. Lending and giving back each save the loan and the item's status
// in one transaction, through the same rules as the rest of the app, so a loan and its item can't
// disagree about whether it's out.
import type { IsoDate } from '@/core/dates'
import type { Gear } from '@/core/gear'
import { changeStatus } from '@/core/lifecycle'
import { returnLoan, type Loan } from '@/core/loans'
import type { BodycapDatabase } from './db'
import { live } from './live'
import { countChange, toGear, toRecord } from './records'
import {
  GearNotFoundError,
  RecordNotFoundError,
  RuleError,
  type LoanRepository,
} from './repositories'

export interface LoanRepositoryOptions {
  readonly now: () => Date
  readonly newId: () => string
  /** The calendar date where the person is, for rules such as no return dates in the future */
  readonly today: () => IsoDate
}

export function createLoanRepository(
  db: BodycapDatabase,
  { now, newId, today }: LoanRepositoryOptions,
): LoanRepository {
  /** The item at its new status, saved with the time of the change */
  const moveTo = async (item: Gear, to: 'lent-out' | 'owned', at: string) => {
    const changed = changeStatus(item, { to }, today())
    if (!changed.ok) throw new RuleError(Object.values(changed.error).join(' '))
    await db.gear.put(toRecord({ ...changed.value, updatedAt: at }))
  }

  return {
    list: () => live(() => db.loans.toArray()),

    forGear: (gearId) => live(() => db.loans.where('gearId').equals(gearId).toArray()),

    lend: (gearId, details) =>
      db.transaction('rw', [db.gear, db.loans, db.settings], async () => {
        const record = await db.gear.get(gearId)
        if (record === undefined) throw new GearNotFoundError(gearId)
        const at = now().toISOString()
        await moveTo(toGear(record), 'lent-out', at)
        const loan: Loan = { ...details, gearId, id: newId(), createdAt: at, updatedAt: at }
        await db.loans.add(loan)
        await countChange(db)
        return loan
      }),

    giveBack: (id, returnedOn) =>
      db.transaction('rw', [db.gear, db.loans, db.settings], async () => {
        const saved = await db.loans.get(id)
        if (saved === undefined) throw new RecordNotFoundError('loan', id)
        const returned = returnLoan(saved, returnedOn, today())
        if (!returned.ok) throw new RuleError(returned.error)
        const at = now().toISOString()
        const loan: Loan = { ...returned.value, updatedAt: at }
        await db.loans.put(loan)
        // Only an item still lent out comes home: one lost while lent, say, stays lost
        const record = await db.gear.get(saved.gearId)
        if (record?.status === 'lent-out') await moveTo(toGear(record), 'owned', at)
        await countChange(db)
        return loan
      }),

    update: (id, details) =>
      db.transaction('rw', db.loans, db.settings, async () => {
        const saved = await db.loans.get(id)
        if (saved === undefined) throw new RecordNotFoundError('loan', id)
        const { gearId, returnedOn, createdAt } = saved
        const loan: Loan = {
          ...details,
          id,
          gearId,
          ...(returnedOn === undefined ? {} : { returnedOn }),
          createdAt,
          updatedAt: now().toISOString(),
        }
        await db.loans.put(loan)
        await countChange(db)
        return loan
      }),
  }
}
