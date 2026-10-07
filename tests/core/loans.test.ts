// Loans: which gear can be lent, checking a loan as typed, returning it, and which loans are overdue.
import { describe, expect, it } from 'vitest'
import { STATUSES } from '@/core/gear'
import {
  activeLoan,
  canLend,
  daysOverdue,
  emptyLoanInput,
  isOverdue,
  overdueLoans,
  returnLoan,
  toLoanInput,
  validateLoan,
  type Loan,
  type LoanDetails,
  type LoanInput,
} from '@/core/loans'
import { err, ok } from '@/core/result'

const TODAY = '2026-10-07'

const typed = (fields: Partial<LoanInput>): LoanInput => ({
  ...emptyLoanInput(TODAY),
  borrower: 'Aroha',
  ...fields,
})

let ids = 0
const loan = (fields: Partial<Loan> = {}): Loan => {
  ids += 1
  return {
    id: `loan-${String(ids)}`,
    gearId: 'gear-1',
    borrower: 'Aroha',
    dateOut: '2026-09-20',
    createdAt: '2026-09-20T09:00:00.000Z',
    updatedAt: '2026-09-20T09:00:00.000Z',
    ...fields,
  }
}

describe('canLend', () => {
  it.each(STATUSES)('lends gear that is %s only if it is owned and at home', (status) => {
    expect(canLend(status)).toBe(status === 'owned')
  })
})

describe('emptyLoanInput', () => {
  it('starts with the item going out today', () => {
    expect(emptyLoanInput(TODAY)).toEqual({
      borrower: '',
      contact: '',
      dateOut: TODAY,
      dueDate: '',
      notes: '',
    })
  })
})

describe('validateLoan', () => {
  it.each<[string, Partial<LoanInput>, LoanDetails]>([
    ['who has it and since when', {}, { borrower: 'Aroha', dateOut: TODAY }],
    [
      'every detail, tidied',
      {
        borrower: '  Aroha   Ngata ',
        contact: ' 021 123 4567 ',
        dateOut: '2026-10-01',
        dueDate: '2026-10-14',
        notes: 'With the spare battery.\r\nBack by Friday.',
      },
      {
        borrower: 'Aroha Ngata',
        contact: '021 123 4567',
        dateOut: '2026-10-01',
        dueDate: '2026-10-14',
        notes: 'With the spare battery.\nBack by Friday.',
      },
    ],
    [
      'a loan entered late, already past its due date',
      { dateOut: '2026-09-01', dueDate: '2026-09-15' },
      { borrower: 'Aroha', dateOut: '2026-09-01', dueDate: '2026-09-15' },
    ],
    [
      'a loan due back the day it went out',
      { dueDate: TODAY },
      { borrower: 'Aroha', dateOut: TODAY, dueDate: TODAY },
    ],
  ])('reads %s', (_name, fields, expected) => {
    expect(validateLoan(typed(fields), TODAY)).toEqual(ok(expected))
  })

  it.each<[Partial<LoanInput>, keyof LoanInput, string]>([
    [{ borrower: ' ' }, 'borrower', "Enter who's borrowing it."],
    [
      { borrower: 'a'.repeat(121) },
      'borrower',
      "Keep the borrower's name to 120 characters or fewer.",
    ],
    [
      { contact: 'a'.repeat(121) },
      'contact',
      'Keep the contact details to 120 characters or fewer.',
    ],
    [{ dateOut: '' }, 'dateOut', 'Enter the date it went out.'],
    [{ dateOut: '2026-13-01' }, 'dateOut', 'Enter a real date.'],
    [{ dateOut: '2026-10-08' }, 'dateOut', "The date it went out can't be in the future."],
    [{ dueDate: 'next week' }, 'dueDate', 'Enter a real date.'],
    [
      { dateOut: '2026-10-05', dueDate: '2026-10-04' },
      'dueDate',
      "It can't be due back before it went out.",
    ],
    [{ notes: 'a'.repeat(2001) }, 'notes', 'Keep the notes to 2,000 characters or fewer.'],
  ])('turns down %o, saying what to fix in %s', (fields, field, message) => {
    expect(validateLoan(typed(fields), TODAY)).toMatchObject({
      ok: false,
      error: { [field]: message },
    })
  })

  it('reports every problem at once', () => {
    expect(validateLoan(typed({ borrower: '', dateOut: '' }), TODAY)).toEqual(
      err({ borrower: "Enter who's borrowing it.", dateOut: 'Enter the date it went out.' }),
    )
  })
})

describe('toLoanInput', () => {
  it.each<LoanDetails>([
    { borrower: 'Aroha', dateOut: '2026-10-01' },
    {
      borrower: 'Aroha Ngata',
      contact: 'aroha@example.com',
      dateOut: '2026-10-01',
      dueDate: '2026-10-14',
      notes: 'With the spare battery.\nBack by Friday.',
    },
  ])('fills the form so that saving %o unchanged gives it back exactly', (details) => {
    expect(validateLoan(toLoanInput(details), TODAY)).toEqual(ok(details))
  })
})

describe('returnLoan', () => {
  it('records the day it came back', () => {
    const out = loan({ dueDate: '2026-10-01' })
    expect(returnLoan(out, '2026-10-06', TODAY)).toEqual(ok({ ...out, returnedOn: '2026-10-06' }))
  })

  it('accepts it coming back the day it went out', () => {
    const out = loan({ dateOut: TODAY })
    expect(returnLoan(out, TODAY, TODAY)).toEqual(ok({ ...out, returnedOn: TODAY }))
  })

  it.each([
    ['', 'Enter the date it came back.'],
    ['2026-10-32', 'Enter a real date.'],
    ['2026-10-08', "The date it came back can't be in the future."],
    ['2026-09-19', "It can't have come back before it went out."],
  ])('turns down a return date of %o', (returnedOn, message) => {
    expect(returnLoan(loan(), returnedOn, TODAY)).toEqual(err(message))
  })

  it('turns down returning a loan twice', () => {
    expect(returnLoan(loan({ returnedOn: '2026-10-01' }), TODAY, TODAY)).toEqual(
      err('This loan has already been returned.'),
    )
  })
})

describe('overdue loans', () => {
  it.each<[string, Partial<Loan>, number]>([
    ['six days past its due date', { dueDate: '2026-10-01' }, 6],
    ['due back today', { dueDate: TODAY }, 0],
    ['due back tomorrow', { dueDate: '2026-10-08' }, 0],
    ['open-ended, with no due date', {}, 0],
    ['returned late', { dueDate: '2026-10-01', returnedOn: '2026-10-03' }, 0],
  ])('counts a loan %s as %i days overdue', (_name, fields, days) => {
    expect(daysOverdue(loan(fields), TODAY)).toBe(days)
    expect(isOverdue(loan(fields), TODAY)).toBe(days > 0)
  })

  it('lists active loans past their due date, the longest overdue first', () => {
    const late = loan({ dueDate: '2026-10-05' })
    const later = loan({ dueDate: '2026-09-28' })
    const loans = [
      late,
      loan({ dueDate: '2026-10-20' }),
      later,
      loan({ dueDate: '2026-09-25', returnedOn: '2026-10-01' }),
      loan(),
    ]
    expect(overdueLoans(loans, TODAY)).toEqual([later, late])
  })

  it('finds the loan an item is out on now, ignoring ones already returned', () => {
    const returned = loan({ returnedOn: '2026-09-30' })
    const current = loan({ dateOut: '2026-10-02' })
    const otherItem = loan({ gearId: 'gear-2' })
    expect(activeLoan([returned, otherItem, current], 'gear-1')).toBe(current)
    expect(activeLoan([returned, otherItem], 'gear-1')).toBeUndefined()
  })
})
