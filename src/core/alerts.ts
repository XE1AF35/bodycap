// What the dashboard flags: warranties running out, backups falling behind, storage filling up,
// loans past due, and items entered twice. Each check is pure, so the dashboard just reads the list.
import { daysBetween, type IsoDate } from './dates'
import { isHeld, type Gear } from './gear'
import { daysOverdue, overdueLoans, type LoanFields } from './loans'
import { findDuplicateSerials, type DuplicateSerial } from './serials'

export const WARRANTY_DAYS_AHEAD = 60
export const WARRANTY_DAYS_AFTER = 30
export const BACKUP_DUE_DAYS = 14
export const BACKUP_DUE_CHANGES = 20
export const STORAGE_NEARLY_FULL = 0.8

export type AlertItem = Pick<Gear, 'id' | 'brand' | 'status' | 'serialNumber' | 'warrantyExpiry'>

export interface WarrantyAlert {
  readonly id: string
  readonly warrantyExpiry: IsoDate
  /** Negative once the warranty has ended */
  readonly daysLeft: number
}

/** Gear you have whose warranty ends soon or ended recently, earliest first. */
export function expiringWarranties(items: Iterable<AlertItem>, today: IsoDate): WarrantyAlert[] {
  const alerts: WarrantyAlert[] = []
  for (const { id, status, warrantyExpiry } of items) {
    if (warrantyExpiry === undefined || !isHeld(status)) continue
    const daysLeft = daysBetween(today, warrantyExpiry)
    if (daysLeft >= -WARRANTY_DAYS_AFTER && daysLeft <= WARRANTY_DAYS_AHEAD) {
      alerts.push({ id, warrantyExpiry, daysLeft })
    }
  }
  return alerts.sort((a, b) => a.daysLeft - b.daysLeft)
}

export interface BackupState {
  /** The local date of the last backup, if there's been one */
  readonly lastBackupOn?: IsoDate | undefined
  readonly changesSinceBackup: number
  /** Days after a backup before the reminder, as chosen in Settings. Two weeks by default. */
  readonly dueDays?: number | undefined
}

export type BackupReminder =
  | { readonly reason: 'never'; readonly changes: number }
  | { readonly reason: 'changes' | 'age'; readonly daysSince: number; readonly changes: number }

/** Why a backup is due, if it is. With nothing changed since the last one, none is needed. */
export function backupReminder(
  { lastBackupOn, changesSinceBackup: changes, dueDays = BACKUP_DUE_DAYS }: BackupState,
  today: IsoDate,
): BackupReminder | undefined {
  if (changes === 0) return undefined
  if (lastBackupOn === undefined) return { reason: 'never', changes }
  const daysSince = daysBetween(lastBackupOn, today)
  if (changes >= BACKUP_DUE_CHANGES) return { reason: 'changes', daysSince, changes }
  if (daysSince >= dueDays) return { reason: 'age', daysSince, changes }
  return undefined
}

/** What the browser reports about its storage. Any of it can be missing. */
export interface StorageState {
  readonly usage?: number
  readonly quota?: number
  readonly persisted?: boolean
}

/** The share of storage used, if it's nearly full. */
export function storageNearlyFull({ usage, quota }: StorageState): number | undefined {
  if (usage === undefined || quota === undefined || quota <= 0) return undefined
  const usedFraction = usage / quota
  return usedFraction >= STORAGE_NEARLY_FULL ? usedFraction : undefined
}

export interface OverdueLoanAlert {
  readonly loanId: string
  readonly gearId: string
  readonly borrower: string
  readonly daysOverdue: number
}

export type AlertLoan = LoanFields & { readonly id: string }

/**
 * Loans past their due date, the longest overdue first. Only gear still lent out counts: an item
 * lost while lent, say, won't come back by chasing the loan.
 */
export function overdueLoanAlerts(
  loans: readonly AlertLoan[],
  items: readonly AlertItem[],
  today: IsoDate,
): OverdueLoanAlert[] {
  const lent = new Set(items.filter(({ status }) => status === 'lent-out').map(({ id }) => id))
  return overdueLoans(loans, today)
    .filter(({ gearId }) => lent.has(gearId))
    .map((loan) => ({
      loanId: loan.id,
      gearId: loan.gearId,
      borrower: loan.borrower,
      daysOverdue: daysOverdue(loan, today),
    }))
}

export type Alert =
  | ({ readonly kind: 'backup' } & BackupReminder)
  | { readonly kind: 'storage-nearly-full'; readonly usedFraction: number }
  | { readonly kind: 'storage-not-persisted' }
  | ({ readonly kind: 'overdue-loan' } & OverdueLoanAlert)
  | ({ readonly kind: 'warranty' } & WarrantyAlert)
  | ({ readonly kind: 'duplicate-serial' } & DuplicateSerial)

export interface AlertInput {
  readonly items: readonly AlertItem[]
  readonly loans: readonly AlertLoan[]
  readonly backup: BackupState
  readonly storage: StorageState
}

/** Every alert, with the ones that protect your data first. */
export function collectAlerts(
  { items, loans, backup, storage }: AlertInput,
  today: IsoDate,
): Alert[] {
  const alerts: Alert[] = []
  const reminder = backupReminder(backup, today)
  if (reminder) alerts.push({ kind: 'backup', ...reminder })
  const usedFraction = storageNearlyFull(storage)
  if (usedFraction !== undefined) alerts.push({ kind: 'storage-nearly-full', usedFraction })
  // Browsers decide this quietly, so not being persisted yet is normal and only worth a gentle note
  if (storage.persisted === false) alerts.push({ kind: 'storage-not-persisted' })
  for (const overdue of overdueLoanAlerts(loans, items, today)) {
    alerts.push({ kind: 'overdue-loan', ...overdue })
  }
  for (const warranty of expiringWarranties(items, today)) {
    alerts.push({ kind: 'warranty', ...warranty })
  }
  for (const duplicate of findDuplicateSerials(items)) {
    alerts.push({ kind: 'duplicate-serial', ...duplicate })
  }
  return alerts
}
