// The maintenance log on an item's page: logging work with its cost in any currency, the messages,
// the firmware version only for firmware updates, the list and its totals, editing, and deleting.
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { addDays, formatDate, toIsoDate } from '@/core/dates'
import type { GearFields } from '@/core/gear'
import type { MaintenanceDetails } from '@/core/maintenance'
import type { Live } from '@/data/repositories'
import { renderApp, testServices } from './support'

const TODAY = toIsoDate(new Date())
const day = (offset: number) => addDays(TODAY, offset)

const camera: GearFields = {
  category: 'camera-body',
  brand: 'Canon',
  model: 'EOS R6 Mark II',
  mount: 'canon-rf',
  purchasePrice: { amountMinor: 429900, currency: 'NZD' },
  status: 'owned',
}

/** The first value a live query gives */
function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}

async function renderItem() {
  const services = testServices()
  const item = await services.repositories.gear.add(camera)
  renderApp(`/gear/${item.id}`, services)
  await screen.findByRole('heading', { level: 1, name: 'Canon EOS R6 Mark II' })
  const section = await screen.findByRole('region', { name: 'Maintenance' })
  return { services, item, section: within(section), user: userEvent.setup() }
}

const dialog = async (name: string) => within(await screen.findByRole('dialog', { name }))

describe('the maintenance log', () => {
  it('says when nothing has been logged yet', async () => {
    const { section } = await renderItem()
    expect(section.getByText('Nothing logged yet.')).toBeVisible()
  })

  it('logs work with its cost in any currency, and lists it', async () => {
    const { user, services, item, section } = await renderItem()
    await user.click(section.getByRole('button', { name: 'Log work' }))
    const form = await dialog('Log work on Canon EOS R6 Mark II')
    expect(form.getByLabelText('Date')).toHaveValue(TODAY)
    await user.selectOptions(form.getByRole('combobox', { name: 'What was done' }), 'Repair')
    const cost = within(form.getByRole('group', { name: 'Cost' }))
    expect(cost.getByRole('combobox', { name: 'Currency' })).toHaveValue('NZD')
    await user.type(cost.getByRole('textbox', { name: 'Amount' }), '349.95')
    await user.selectOptions(cost.getByRole('combobox', { name: 'Currency' }), 'AUD')
    await user.type(form.getByRole('textbox', { name: 'Who did it' }), 'Canon Australia')
    await user.click(form.getByRole('button', { name: 'Save' }))

    const record = await section.findByRole('listitem')
    expect(within(record).getByRole('heading', { name: 'Repair' })).toBeVisible()
    expect(record).toHaveTextContent(formatDate(TODAY))
    expect(record).toHaveTextContent('A$349.95')
    expect(record).toHaveTextContent('Canon Australia')
    expect(await current(services.repositories.maintenance.forGear(item.id))).toMatchObject([
      { type: 'repair', date: TODAY, cost: { amountMinor: 34995, currency: 'AUD' } },
    ])
  })

  it('says what to fix at each field', async () => {
    const { user, section } = await renderItem()
    await user.click(section.getByRole('button', { name: 'Log work' }))
    const form = await dialog('Log work on Canon EOS R6 Mark II')
    fireEvent.change(form.getByLabelText('Date'), { target: { value: day(1) } })
    await user.click(form.getByRole('button', { name: 'Save' }))
    expect(form.getByRole('combobox', { name: 'What was done' })).toHaveAccessibleDescription(
      'Error: Choose what was done.',
    )
    expect(form.getByLabelText('Date')).toHaveAccessibleDescription(
      "Error: The date can't be in the future.",
    )
    expect(form.getByRole('combobox', { name: 'What was done' })).toHaveFocus()
  })

  it('asks for the firmware version only for a firmware update', async () => {
    const { user, section } = await renderItem()
    await user.click(section.getByRole('button', { name: 'Log work' }))
    const form = await dialog('Log work on Canon EOS R6 Mark II')
    const kind = form.getByRole('combobox', { name: 'What was done' })
    expect(form.queryByRole('textbox', { name: 'Firmware version' })).not.toBeInTheDocument()
    await user.selectOptions(kind, 'Firmware update')
    expect(form.getByRole('textbox', { name: 'Firmware version' })).toBeVisible()
    await user.selectOptions(kind, 'Sensor clean')
    expect(form.queryByRole('textbox', { name: 'Firmware version' })).not.toBeInTheDocument()
  })

  it('lists the most recent first, with what was spent in each currency', async () => {
    const services = testServices()
    const item = await services.repositories.gear.add(camera)
    const add = (details: MaintenanceDetails) =>
      services.repositories.maintenance.add(item.id, details)
    await add({
      type: 'sensor-clean',
      date: day(-200),
      cost: { amountMinor: 8900, currency: 'NZD' },
    })
    await add({ type: 'firmware-update', date: day(-10), firmwareVersion: '1.3.0' })
    await add({ type: 'repair', date: day(-60), cost: { amountMinor: 34995, currency: 'AUD' } })
    await add({
      type: 'sensor-clean',
      date: day(-30),
      cost: { amountMinor: 8900, currency: 'NZD' },
    })
    renderApp(`/gear/${item.id}`, services)
    const section = within(await screen.findByRole('region', { name: 'Maintenance' }))
    expect(
      (await section.findAllByRole('heading', { level: 3 })).map((heading) => heading.textContent),
    ).toEqual(['Firmware update', 'Sensor clean', 'Repair', 'Sensor clean'])
    expect(section.getByText('Version 1.3.0')).toBeVisible()
    expect(section.getByText('Spent so far: $178.00 and A$349.95')).toBeVisible()
  })

  it('edits a record, starting from what was saved', async () => {
    const { user, services, item, section } = await renderItem()
    await services.repositories.maintenance.add(item.id, {
      type: 'sensor-clean',
      date: day(-3),
      provider: 'Camera Clinic',
    })
    await user.click(
      await section.findByRole('button', { name: `Edit Sensor clean, ${formatDate(day(-3))}` }),
    )
    const form = await dialog('Edit the sensor clean on Canon EOS R6 Mark II')
    const provider = form.getByRole('textbox', { name: 'Who did it' })
    expect(provider).toHaveValue('Camera Clinic')
    await user.clear(provider)
    await user.type(provider, 'Done at home')
    await user.click(form.getByRole('button', { name: 'Save' }))
    expect(await section.findByText('Done at home')).toBeVisible()
  })

  it('deletes a record only after confirming', async () => {
    const { user, services, item, section } = await renderItem()
    await services.repositories.maintenance.add(item.id, { type: 'repair', date: day(-3) })
    await user.click(
      await section.findByRole('button', { name: `Delete Repair, ${formatDate(day(-3))}` }),
    )
    const confirm = within(await screen.findByRole('alertdialog'))
    await user.click(confirm.getByRole('button', { name: 'Delete' }))
    expect(await section.findByText('Nothing logged yet.')).toBeVisible()
    expect(await current(services.repositories.maintenance.forGear(item.id))).toEqual([])
  })
})
