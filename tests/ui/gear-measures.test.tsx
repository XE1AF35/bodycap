// Weight and filter thread in the gear form: which items ask for them, saving and showing them, and
// filling them from a picked model, which also links the item to that model until it's renamed.
import { screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GearFields } from '@/core/gear'
import type { Live } from '@/data/repositories'
import { renderApp, testServices } from './support'

// The small test catalogue, whose models have weights and filter threads
vi.mock('@/core/catalogue/data', async () => {
  const { CATALOGUE } = await import('../core/catalogue/support')
  return { CATALOGUE }
})

/** The first value a live query gives */
function current<T>(live: Live<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = live.subscribe((value) => {
      resolve(value)
      queueMicrotask(stop)
    }, reject)
  })
}

const field = (name: string) => screen.getByRole('textbox', { name })
const select = (name: string) => screen.getByRole('combobox', { name })
const model = () => screen.getByRole('combobox', { name: /^Model/ })
const save = (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Save' }))
const shown = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent

async function renderAdd() {
  const services = testServices()
  renderApp('/gear/new', services)
  await screen.findByRole('heading', { level: 1, name: 'Add gear' })
  return { services, user: userEvent.setup() }
}

async function pick(user: UserEvent, typed: string, name: RegExp) {
  await user.type(model(), typed)
  await user.click(await screen.findByRole('option', { name }))
}

describe('weight and filter thread', () => {
  it.each([
    ['Bag', true, false],
    ['Camera body', true, false],
    ['Lens', true, true],
    ['Filter', true, true],
  ])(
    'a %s asks for its weight: %s, and its filter thread: %s',
    async (category, weight, thread) => {
      const { user } = await renderAdd()
      await user.selectOptions(select('Category'), category)
      expect(screen.queryByRole('textbox', { name: 'Weight' }) !== null).toBe(weight)
      expect(screen.queryByRole('textbox', { name: 'Filter thread' }) !== null).toBe(thread)
    },
  )

  it('saves them as typed, and shows them on the item page', async () => {
    const { user, services } = await renderAdd()
    await user.selectOptions(select('Category'), 'Lens')
    await user.type(field('Brand'), 'Canon')
    await user.type(model(), 'RF 100-500mm F4.5-7.1 L IS USM')
    await user.tab()
    await user.type(field('Filter thread'), '77mm')
    await user.type(field('Weight'), '1,370 g')
    await save(user)
    await screen.findByRole('heading', { level: 1, name: /RF 100-500mm/ })
    expect([shown('Filter thread'), shown('Weight')]).toEqual(['77 mm', '1,370 g'])
    expect(await current(services.repositories.gear.list())).toMatchObject([
      { filterThread: 77, weight: 1370 },
    ])
  })

  it('explains a weight it cannot read', async () => {
    const { user } = await renderAdd()
    await user.selectOptions(select('Category'), 'Bag')
    await user.type(field('Brand'), 'Peak Design')
    await user.type(model(), 'Everyday Sling 6L')
    await user.tab()
    await user.type(field('Weight'), '1.2 kg')
    await save(user)
    expect(
      await screen.findAllByText('Enter the weight in whole grams, such as 658.'),
    ).not.toHaveLength(0)
  })

  it('fills them from a picked lens, says so, and links the item to that model', async () => {
    const { user, services } = await renderAdd()
    await user.selectOptions(select('Category'), 'Lens')
    await pick(user, '50 1.8', /FE 50mm F1.8/)
    expect(field('Filter thread')).toHaveValue('49')
    expect(field('Weight')).toHaveValue('186')
    expect(screen.getByText(/aperture, filter thread, and weight\./)).toHaveAttribute(
      'role',
      'status',
    )
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Sony FE 50mm F1.8' })
    expect(await current(services.repositories.gear.list())).toMatchObject([
      { weight: 186, filterThread: 49, catalogueId: 'sony-fe-50mm-f1-8' },
    ])
  })

  it('drops the link when the model is changed to another', async () => {
    const { user, services } = await renderAdd()
    await pick(user, 'a7 iv', /a7 IV/)
    await user.clear(model())
    await user.type(model(), 'a7R IV')
    await user.tab()
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Sony a7R IV' })
    const [item] = await current(services.repositories.gear.list())
    expect(item).toMatchObject({ weight: 658 })
    expect(item).not.toHaveProperty('catalogueId')
  })

  it('keeps the link of a saved item while its name stays the same', async () => {
    const services = testServices()
    const body: GearFields = {
      category: 'camera-body',
      brand: 'Sony',
      model: 'a7 IV',
      weight: 658,
      catalogueId: 'sony-a7-iv',
      status: 'owned',
    }
    const item = await services.repositories.gear.add(body)
    renderApp(`/gear/${item.id}/edit`, services)
    await screen.findByRole('heading', { level: 1, name: 'Edit Sony a7 IV' })
    const user = userEvent.setup()
    await user.type(field('Nickname'), 'Main body')
    await save(user)
    await screen.findByRole('heading', { level: 1, name: 'Sony a7 IV' })
    expect(await current(services.repositories.gear.get(item.id))).toMatchObject({
      nickname: 'Main body',
      catalogueId: 'sony-a7-iv',
    })
  })
})
