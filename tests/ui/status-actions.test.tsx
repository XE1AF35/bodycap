// Status buttons on an item's page: only the changes the lifecycle allows, each with its dialog,
// the change saved with any loan, and the messages when something doesn't fit.
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { addDays, toIsoDate } from '@/core/dates'
import type { GearFields } from '@/core/gear'
import type { Live } from '@/data/repositories'
import { renderApp, testServices } from './support'

const TODAY = toIsoDate(new Date())

const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  mount: 'sony-e',
  purchaseDate: '2026-03-01',
  purchasePrice: { amountMinor: 389900, currency: 'NZD' },
  status: 'owned',
}

const NAME = 'Sony FE 24-70mm F2.8 GM II'

/** The first value a live query gives */
function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}

/** An item's page, with the item saved just before */
async function renderItem(fields: GearFields = lens) {
  const services = testServices()
  const item = await services.repositories.gear.add(fields)
  renderApp(`/gear/${item.id}`, services)
  await screen.findByRole('heading', { level: 1, name: `${fields.brand} ${fields.model}` })
  return { services, item, user: userEvent.setup() }
}

const bar = () => within(screen.getByRole('group', { name: 'Change status' }))
const saved = async (services: ReturnType<typeof testServices>, id: string) =>
  current(services.repositories.gear.get(id))

/** Waits for the status line to say what changed */
const announced = (text: string) => screen.findByText(text, { selector: '[role="status"]' })

describe('status buttons', () => {
  it.each<[GearFields['status'], Partial<GearFields>, string[]]>([
    ['owned', {}, ['Lend', 'Repair', 'Sold', 'Lost']],
    ['lent-out', {}, ['Returned', 'Lost']],
    ['in-repair', {}, ['Back from repair', 'Sold', 'Lost']],
    ['wishlist', {}, ['Bought it']],
    [
      'sold',
      { saleDate: '2026-09-20', salePrice: { amountMinor: 250000, currency: 'NZD' } },
      ['Own it again'],
    ],
    ['lost', { lostDate: '2026-09-01' }, ['Found it']],
  ])('offers only the changes the lifecycle allows from %s', async (status, extra, buttons) => {
    await renderItem({ ...lens, ...extra, status })
    expect(
      bar()
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(buttons)
  })

  it('lends an item, asking who has it first, and saves the loan with the status', async () => {
    const { user, services, item } = await renderItem()
    await user.click(bar().getByRole('button', { name: 'Lend' }))
    const dialog = within(await screen.findByRole('dialog', { name: `Lend ${NAME}` }))
    expect(dialog.getByLabelText('Date it went out')).toHaveValue(TODAY)

    await user.click(dialog.getByRole('button', { name: 'Lend' }))
    expect(dialog.getByRole('textbox', { name: "Who's borrowing it" })).toHaveAccessibleDescription(
      "Error: Enter who's borrowing it.",
    )

    await user.type(dialog.getByRole('textbox', { name: "Who's borrowing it" }), 'Aroha')
    await user.type(dialog.getByRole('textbox', { name: 'Contact' }), '021 123 4567')
    fireEvent.change(dialog.getByLabelText('Due back'), { target: { value: addDays(TODAY, 7) } })
    await user.click(dialog.getByRole('button', { name: 'Lend' }))

    expect(await announced('Lent to Aroha.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Focus comes back to the bar, landing on its first button, Returned, as Lend has gone
    expect(screen.getByRole('group', { name: 'Change status' })).toContainElement(
      document.activeElement as HTMLElement | null,
    )
    expect(await saved(services, item.id)).toMatchObject({ status: 'lent-out' })
    expect(await current(services.repositories.loans.forGear(item.id))).toMatchObject([
      { borrower: 'Aroha', contact: '021 123 4567', dateOut: TODAY, dueDate: addDays(TODAY, 7) },
    ])
  })

  it('returns a lent item on the day given, closing its loan', async () => {
    const { user, services, item } = await renderItem()
    const loan = await services.repositories.loans.lend(item.id, {
      borrower: 'Aroha',
      dateOut: addDays(TODAY, -5),
    })
    await user.click(await screen.findByRole('button', { name: 'Returned' }))
    const dialog = within(await screen.findByRole('dialog', { name: `${NAME} is back` }))
    fireEvent.change(dialog.getByLabelText('Date it came back'), {
      target: { value: addDays(TODAY, -1) },
    })
    await user.click(dialog.getByRole('button', { name: 'Mark as returned' }))
    expect(await announced('Marked as returned.')).toBeInTheDocument()
    expect(await saved(services, item.id)).toMatchObject({ status: 'owned' })
    expect(await current(services.repositories.loans.forGear(item.id))).toEqual([
      expect.objectContaining({ id: loan.id, returnedOn: addDays(TODAY, -1) }),
    ])
  })

  it('explains a return date that does not fit, keeping the dialog open', async () => {
    const { user, services, item } = await renderItem()
    await services.repositories.loans.lend(item.id, { borrower: 'Aroha', dateOut: TODAY })
    await user.click(await screen.findByRole('button', { name: 'Returned' }))
    const dialog = within(await screen.findByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Date it came back'), {
      target: { value: addDays(TODAY, -3) },
    })
    await user.click(dialog.getByRole('button', { name: 'Mark as returned' }))
    expect(dialog.getByLabelText('Date it came back')).toHaveAccessibleDescription(
      "Error: It can't have come back before it went out.",
    )
    expect(await saved(services, item.id)).toMatchObject({ status: 'lent-out' })
  })

  it('returns an item marked lent out with no loan recorded, as older data can be', async () => {
    const { user, services, item } = await renderItem({ ...lens, status: 'lent-out' })
    await user.click(bar().getByRole('button', { name: 'Returned' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Mark as returned' }))
    expect(await announced('Marked as returned.')).toBeInTheDocument()
    expect(await saved(services, item.id)).toMatchObject({ status: 'owned' })
  })

  it('records a sale with its date and price, which it asks for', async () => {
    const { user, services, item } = await renderItem()
    await user.click(bar().getByRole('button', { name: 'Sold' }))
    const dialog = within(await screen.findByRole('dialog', { name: `Sell ${NAME}` }))
    await user.click(dialog.getByRole('button', { name: 'Mark as sold' }))
    expect(dialog.getByRole('textbox', { name: 'Amount' })).toHaveAccessibleDescription(
      'Error: Enter what it sold for.',
    )
    await user.type(dialog.getByRole('textbox', { name: 'Amount' }), '2,500')
    await user.click(dialog.getByRole('button', { name: 'Mark as sold' }))
    expect(await announced('Marked as sold.')).toBeInTheDocument()
    expect(await saved(services, item.id)).toMatchObject({
      status: 'sold',
      saleDate: TODAY,
      salePrice: { amountMinor: 250000, currency: 'NZD' },
    })
  })

  it('records the date something was lost, refusing one in the future', async () => {
    const { user, services, item } = await renderItem()
    await user.click(bar().getByRole('button', { name: 'Lost' }))
    const dialog = within(await screen.findByRole('dialog', { name: `${NAME} is lost` }))
    fireEvent.change(dialog.getByLabelText('Date lost'), { target: { value: addDays(TODAY, 1) } })
    await user.click(dialog.getByRole('button', { name: 'Mark as lost' }))
    expect(dialog.getByLabelText('Date lost')).toHaveAccessibleDescription(
      "Error: The date it was lost can't be in the future.",
    )
    fireEvent.change(dialog.getByLabelText('Date lost'), { target: { value: TODAY } })
    await user.click(dialog.getByRole('button', { name: 'Mark as lost' }))
    expect(await announced('Marked as lost.')).toBeInTheDocument()
    expect(await saved(services, item.id)).toMatchObject({ status: 'lost', lostDate: TODAY })
  })

  it.each<[string, Partial<GearFields>, string, string, string]>([
    ['sends it for repair', {}, 'Repair', 'Mark as in repair', 'in-repair'],
    [
      'brings it back from repair',
      { status: 'in-repair' },
      'Back from repair',
      'Mark as owned',
      'owned',
    ],
    ['moves it off the wishlist', { status: 'wishlist' }, 'Bought it', 'Mark as owned', 'owned'],
    [
      'owns it again after a sale',
      { status: 'sold', saleDate: '2026-09-20', salePrice: { amountMinor: 1, currency: 'NZD' } },
      'Own it again',
      'Mark as owned',
      'owned',
    ],
    ['finds it', { status: 'lost', lostDate: '2026-09-01' }, 'Found it', 'Mark as owned', 'owned'],
  ])('%s after asking to confirm', async (_name, extra, button, confirm, status) => {
    const { user, services, item } = await renderItem({ ...lens, ...extra })
    await user.click(bar().getByRole('button', { name: button }))
    const dialog = within(await screen.findByRole('alertdialog'))
    await user.click(dialog.getByRole('button', { name: confirm }))
    expect(
      await announced(`Marked as ${status === 'owned' ? 'owned' : 'in repair'}.`),
    ).toBeVisible()
    const after = await saved(services, item.id)
    expect(after).toMatchObject({ status })
    // What only fitted the old status goes, as it does when the status changes in the form
    expect(after).not.toHaveProperty('saleDate')
    expect(after).not.toHaveProperty('lostDate')
  })

  it('changes nothing when the dialog is cancelled', async () => {
    const { user, services, item } = await renderItem()
    await user.click(bar().getByRole('button', { name: 'Lost' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await saved(services, item.id)).toMatchObject({ status: 'owned' })
  })
})
