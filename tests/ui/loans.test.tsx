// Loans on screen: the loan an item is out on, earlier loans, editing a loan, and what's out and
// overdue on the dashboard.
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { addDays, formatDate, toIsoDate } from '@/core/dates'
import type { GearFields } from '@/core/gear'
import type { Live } from '@/data/repositories'
import type { StorageHelpers } from '@/data/storage'
import { renderApp, testServices } from './support'

const TODAY = toIsoDate(new Date())
const day = (offset: number) => addDays(TODAY, offset)

const camera: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T5',
  mount: 'fujifilm-x',
  status: 'owned',
}

const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 85mm F1.8',
  mount: 'sony-e',
  status: 'owned',
}

// Storage that raises no alerts of its own
const quietStorage: StorageHelpers = {
  requestPersistence: () => Promise.resolve(true),
  storageState: () => Promise.resolve({ persisted: true }),
}

const services = () => testServices({ storage: quietStorage })

/** The first value a live query gives */
function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}

/** What a readout in a section shows next to a label */
const reading = (section: HTMLElement, label: string) =>
  within(section).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent

describe("an item's loans", () => {
  it('shows who has it, how to reach them, and when it went out and is due back', async () => {
    const repos = services()
    const item = await repos.repositories.gear.add(camera)
    await repos.repositories.loans.lend(item.id, {
      borrower: 'Aroha',
      contact: '021 123 4567',
      dateOut: day(-3),
      dueDate: day(4),
      notes: 'With the spare battery.',
    })
    renderApp(`/gear/${item.id}`, repos)
    const loan = await screen.findByRole('region', { name: 'On loan to Aroha' })
    expect(reading(loan, 'Contact')).toBe('021 123 4567')
    expect(reading(loan, 'Went out')).toBe(formatDate(day(-3)))
    expect(reading(loan, 'Due back')).toBe(formatDate(day(4)))
    expect(reading(loan, 'Notes')).toBe('With the spare battery.')
    expect(within(loan).queryByText(/overdue/)).not.toBeInTheDocument()
  })

  it('says how long a loan is overdue', async () => {
    const repos = services()
    const item = await repos.repositories.gear.add(camera)
    await repos.repositories.loans.lend(item.id, {
      borrower: 'Aroha',
      dateOut: day(-10),
      dueDate: day(-6),
    })
    renderApp(`/gear/${item.id}`, repos)
    const loan = await screen.findByRole('region', { name: 'On loan to Aroha' })
    expect(within(loan).getByText('6 days overdue')).toBeVisible()
  })

  it('lists earlier loans, the most recent first', async () => {
    const repos = services()
    const item = await repos.repositories.gear.add(camera)
    const first = await repos.repositories.loans.lend(item.id, {
      borrower: 'Sam',
      dateOut: day(-40),
    })
    await repos.repositories.loans.giveBack(first.id, day(-35))
    const second = await repos.repositories.loans.lend(item.id, {
      borrower: 'Aroha',
      dateOut: day(-20),
    })
    await repos.repositories.loans.giveBack(second.id, day(-18))
    renderApp(`/gear/${item.id}`, repos)
    const earlier = await screen.findByRole('region', { name: 'Earlier loans' })
    expect(
      within(earlier)
        .getAllByRole('listitem')
        .map((loan) => loan.textContent),
    ).toEqual([
      `Aroha, ${formatDate(day(-20))} to ${formatDate(day(-18))}`,
      `Sam, ${formatDate(day(-40))} to ${formatDate(day(-35))}`,
    ])
    expect(screen.queryByRole('region', { name: /^On loan/ })).not.toBeInTheDocument()
  })

  it('shows nothing about loans for an item never lent', async () => {
    const repos = services()
    const item = await repos.repositories.gear.add(camera)
    renderApp(`/gear/${item.id}`, repos)
    await screen.findByRole('heading', { level: 1, name: 'Fujifilm X-T5' })
    expect(screen.queryByRole('region', { name: 'Earlier loans' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /^On loan/ })).not.toBeInTheDocument()
  })

  it('edits the loan, such as moving its due date', async () => {
    const user = userEvent.setup()
    const repos = services()
    const item = await repos.repositories.gear.add(camera)
    await repos.repositories.loans.lend(item.id, {
      borrower: 'Aroha',
      dateOut: day(-3),
      dueDate: day(1),
    })
    renderApp(`/gear/${item.id}`, repos)
    const loan = await screen.findByRole('region', { name: 'On loan to Aroha' })
    await user.click(within(loan).getByRole('button', { name: 'Edit loan' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Edit the loan of Fujifilm X-T5' }),
    )
    expect(dialog.getByRole('textbox', { name: "Who's borrowing it" })).toHaveValue('Aroha')
    fireEvent.change(dialog.getByLabelText('Due back'), { target: { value: day(8) } })
    await user.click(dialog.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(formatDate(day(8)))).toBeVisible()
    expect(await current(repos.repositories.loans.forGear(item.id))).toMatchObject([
      { borrower: 'Aroha', dueDate: day(8) },
    ])
  })
})

describe('loans on the dashboard', () => {
  async function dashboardWithLoans() {
    const repos = services()
    const lentCamera = await repos.repositories.gear.add(camera)
    const lentLens = await repos.repositories.gear.add(lens)
    await repos.repositories.gear.add({ ...lens, model: 'FE 35mm F1.8' })
    await repos.repositories.loans.lend(lentCamera.id, {
      borrower: 'Aroha',
      dateOut: day(-10),
      dueDate: day(-6),
    })
    await repos.repositories.loans.lend(lentLens.id, {
      borrower: 'Sam',
      dateOut: day(-1),
      dueDate: day(5),
    })
    await repos.repositories.backup.create()
    renderApp('/', repos)
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    return repos
  }

  it("lists what's out, the overdue first, each linking to its item", async () => {
    await dashboardWithLoans()
    const out = await screen.findByRole('region', { name: 'On loan' })
    const rows = within(out).getAllByRole('listitem')
    expect(rows.map((row) => within(row).getByRole('link').textContent)).toEqual([
      'Fujifilm X-T5',
      'Sony FE 85mm F1.8',
    ])
    expect(rows[0]).toHaveTextContent('Aroha')
    expect(rows[0]).toHaveTextContent('6 days overdue')
    expect(rows[1]).toHaveTextContent(`Due ${formatDate(day(5))}`)
  })

  it('flags an overdue loan as needing attention, linking to the item', async () => {
    await dashboardWithLoans()
    const attention = await screen.findByRole('region', { name: 'Needs attention' })
    expect(within(attention).getByText(/was due back from Aroha 6 days ago/)).toBeVisible()
    expect(within(attention).getByRole('link', { name: 'Fujifilm X-T5' })).toBeVisible()
  })

  it('leaves out the panel when nothing is out', async () => {
    const repos = services()
    await repos.repositories.gear.add(camera)
    renderApp('/', repos)
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    expect(screen.queryByRole('region', { name: 'On loan' })).not.toBeInTheDocument()
  })
})
