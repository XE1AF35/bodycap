// The Shoots page: the empty log, logging a shoot with its items, every rule's message, and the
// log newest first with how many shoots this year.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { toIsoDate } from '@/core/dates'
import type { GearFields } from '@/core/gear'
import { renderApp, testServices } from './support'

const camera: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T5',
  mount: 'fujifilm-x',
  status: 'owned',
}
const lens: GearFields = {
  category: 'lens',
  brand: 'Fujifilm',
  model: 'XF 33mm F1.4',
  mount: 'fujifilm-x',
  status: 'owned',
}

const today = toIsoDate(new Date())
const year = Number(today.slice(0, 4))

describe('the shoots page', () => {
  it('explains shoots when there are none yet', async () => {
    renderApp('/shoots')
    expect(await screen.findByText('No shoots yet.')).toBeVisible()
    expect(screen.getByText(/A shoot is a time you went out photographing/)).toBeVisible()
  })

  it("lists shoots newest first with their dates and items, and counts this year's", async () => {
    const services = testServices()
    const a = await services.repositories.gear.add(camera)
    const b = await services.repositories.gear.add(lens)
    const shoots = services.repositories.shoots
    await shoots.add({
      date: `${String(year - 1)}-12-31`,
      name: 'New Year fireworks',
      gearIds: [a.id],
    })
    await shoots.add({ date: `${String(year)}-01-01`, name: 'Sunrise walk', gearIds: [] })
    await shoots.add({ date: today, name: 'Wedding, Arrowtown', gearIds: [a.id, b.id] })
    renderApp('/shoots', services)
    const list = within(await screen.findByRole('list', { name: 'Your shoots' }))
    expect(list.getAllByRole('listitem').map((card) => card.textContent)).toEqual([
      expect.stringMatching(/^Wedding, Arrowtown.*2 items$/),
      expect.stringMatching(/^Sunrise walk1 Jan \d{4}No items$/),
      expect.stringMatching(/^New Year fireworks31 Dec \d{4}1 item$/),
    ])
    expect(screen.getByText('2 shoots logged this year.')).toBeVisible()
  })

  it('logs a shoot with the items picked, from every category but the wishlist', async () => {
    const services = testServices()
    await services.repositories.gear.add(camera)
    await services.repositories.gear.add(lens)
    await services.repositories.gear.add({
      category: 'tripod',
      brand: 'Peak Design',
      model: 'Travel Tripod',
      status: 'sold',
      saleDate: '2026-01-01',
    })
    await services.repositories.gear.add({ ...lens, model: 'XF 56mm F1.2', status: 'wishlist' })
    const user = userEvent.setup()
    renderApp('/shoots', services)
    await user.click(await screen.findByRole('button', { name: 'Log a shoot' }))
    const form = within(await screen.findByRole('dialog', { name: 'Log a shoot' }))
    expect(form.getByLabelText(/^Date/)).toHaveValue(today)
    expect(form.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual([
      'Fujifilm X-T5',
      'Fujifilm XF 33mm F1.4',
      'Peak Design Travel Tripod',
    ])
    await user.type(form.getByRole('textbox', { name: 'Name' }), 'Wedding, Arrowtown')
    await user.type(form.getByRole('searchbox', { name: 'Search' }), 'x-t5')
    await user.click(form.getByRole('checkbox', { name: 'Fujifilm X-T5' }))
    await user.clear(form.getByRole('searchbox', { name: 'Search' }))
    await user.click(form.getByRole('checkbox', { name: 'Peak Design Travel Tripod' }))
    await user.type(form.getByRole('textbox', { name: 'Notes' }), 'Rain all day.')
    await user.click(form.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    const list = within(await screen.findByRole('list', { name: 'Your shoots' }))
    expect(list.getByRole('listitem')).toHaveTextContent(/^Wedding, Arrowtown.*2 items$/)
    expect(screen.getByText('1 shoot logged this year.')).toBeVisible()
  })

  it('says what to fix in every field, and saves nothing until it is fixed', async () => {
    const user = userEvent.setup()
    renderApp('/shoots')
    await user.click(await screen.findByRole('button', { name: 'Log a shoot' }))
    const form = within(await screen.findByRole('dialog', { name: 'Log a shoot' }))
    await user.clear(form.getByLabelText(/^Date/))
    await user.click(form.getByRole('textbox', { name: 'Notes' }))
    await user.paste('a'.repeat(2001))
    await user.click(form.getByRole('button', { name: 'Save' }))
    expect(form.getByLabelText(/^Date/)).toHaveAccessibleDescription(
      'Error: Enter the date of the shoot.',
    )
    expect(form.getByLabelText(/^Date/)).toHaveFocus()
    expect(form.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      /Error: Enter a name for the shoot\.$/,
    )
    expect(form.getByRole('textbox', { name: 'Notes' })).toHaveAccessibleDescription(
      'Error: Keep the notes to 2,000 characters or fewer.',
    )
    await user.type(form.getByLabelText(/^Date/), `${String(year + 1)}-01-01`)
    await user.click(form.getByRole('button', { name: 'Save' }))
    expect(form.getByLabelText(/^Date/)).toHaveAccessibleDescription(
      "Error: The date can't be in the future.",
    )
    expect(screen.getByText('No shoots yet.')).toBeInTheDocument()
  })
})
