// Lending gear: who has it, since when, and when it's due back. Only gear at home can be lent, and
// a loan still out is overdue once its due date has passed. Storage saves a loan together with the
// item's change to lent out, and its return together with the change back.
import { daysBetween, type IsoDate } from './dates'
import { fieldErrors, readDate, readText } from './fields'
import type { Status } from './gear'
import { canChangeStatus } from './lifecycle'
import { err, ok, type Result } from './result'

export interface LoanFields {
  readonly gearId: string
  readonly borrower: string
  /** A phone number or email, however the person wrote it */
  readonly contact?: string
  readonly dateOut: IsoDate
  /** Left out for an open-ended loan, which is never overdue */
  readonly dueDate?: IsoDate
  /** Set once the item is back */
  readonly returnedOn?: IsoDate
  readonly notes?: string
}

export interface Loan extends LoanFields {
  readonly id: string
  /** ISO 8601 UTC timestamps */
  readonly createdAt: string
  readonly updatedAt: string
}

/** What the lend form decides: the page supplies the item, and the return comes later */
export type LoanDetails = Omit<LoanFields, 'gearId' | 'returnedOn'>

/** What the lend form holds, as typed */
export interface LoanInput {
  readonly borrower: string
  readonly contact: string
  readonly dateOut: string
  readonly dueDate: string
  readonly notes: string
}

export type LoanErrors = Partial<Record<keyof LoanInput, string>>

/** Whether an item can be lent: only gear you have at home, not gear already out or in repair */
export function canLend(status: Status): boolean {
  return canChangeStatus(status, 'lent-out')
}

/** A blank lend form, with the item going out today */
export function emptyLoanInput(today: IsoDate): LoanInput {
  return { borrower: '', contact: '', dateOut: today, dueDate: '', notes: '' }
}

/** Fills the lend form from a saved loan */
export function toLoanInput(loan: LoanDetails): LoanInput {
  return {
    borrower: loan.borrower,
    contact: loan.contact ?? '',
    dateOut: loan.dateOut,
    dueDate: loan.dueDate ?? '',
    notes: loan.notes ?? '',
  }
}

/** Checks a loan as typed. All problems are reported together. */
export function validateLoan(input: LoanInput, today: IsoDate): Result<LoanDetails, LoanErrors> {
  const { errors, take } = fieldErrors<keyof LoanInput>()

  const borrower = take(
    'borrower',
    readText(input.borrower, { max: 120, name: "the borrower's name" }),
  )
  if (borrower === undefined) errors.borrower ??= "Enter who's borrowing it."
  const contact = take(
    'contact',
    readText(input.contact, { max: 120, name: 'the contact details' }),
  )
  const notes = take(
    'notes',
    readText(input.notes, { max: 2000, name: 'the notes', multiline: true }),
  )

  // Valid dates compare correctly as plain YYYY-MM-DD strings
  const dateOut = take('dateOut', readDate(input.dateOut))
  if (dateOut === undefined) errors.dateOut ??= 'Enter the date it went out.'
  else if (dateOut > today) errors.dateOut = "The date it went out can't be in the future."
  // A due date already past is fine, for a loan entered after the fact
  const dueDate = take('dueDate', readDate(input.dueDate))
  if (dueDate !== undefined && dateOut !== undefined && dueDate < dateOut) {
    errors.dueDate = "It can't be due back before it went out."
  }

  if (borrower === undefined || dateOut === undefined || Object.keys(errors).length > 0) {
    return err(errors)
  }
  return ok({
    borrower,
    ...(contact !== undefined ? { contact } : {}),
    dateOut,
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(notes !== undefined ? { notes } : {}),
  })
}

/**
 * Marks a loan as returned on the date typed. The caller saves it, along with the item going back
 * to owned, which is when updatedAt changes.
 */
export function returnLoan<T extends LoanFields>(
  loan: T,
  returnedOn: string,
  today: IsoDate,
): Result<T> {
  if (loan.returnedOn !== undefined) return err('This loan has already been returned.')
  const date = readDate(returnedOn)
  if (!date.ok) return err(date.error)
  if (date.value === undefined) return err('Enter the date it came back.')
  if (date.value > today) return err("The date it came back can't be in the future.")
  if (date.value < loan.dateOut) return err("It can't have come back before it went out.")
  return ok({ ...loan, returnedOn: date.value })
}

/** Whole days past the due date, or 0 for a loan that's back, open-ended, or not due yet */
export function daysOverdue(loan: LoanFields, today: IsoDate): number {
  if (loan.returnedOn !== undefined || loan.dueDate === undefined) return 0
  return Math.max(0, daysBetween(loan.dueDate, today))
}

export function isOverdue(loan: LoanFields, today: IsoDate): boolean {
  return daysOverdue(loan, today) > 0
}

/** Loans still out and past their due date, the longest overdue first */
export function overdueLoans<T extends LoanFields>(loans: readonly T[], today: IsoDate): T[] {
  return loans
    .filter((loan) => isOverdue(loan, today))
    .sort((a, b) => daysOverdue(b, today) - daysOverdue(a, today))
}

/** The loan an item is out on now, if any */
export function activeLoan<T extends LoanFields>(
  loans: readonly T[],
  gearId: string,
): T | undefined {
  return loans.find((loan) => loan.gearId === gearId && loan.returnedOn === undefined)
}
