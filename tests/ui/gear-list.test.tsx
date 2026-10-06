// The gear list: the table and cards, the count, search and filters kept in the address, and
// sorting by column or from the sort menu.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { GearFields } from '@/core/gear'
import { renderApp, testServices } from './support'

const lens: GearFields = {
  category: 'lens',
  brand: 'Sony',
  model: 'FE 24-70mm F2.8 GM II',
  nickname: 'Workhorse',
  mount: 'sony-e',
  purchaseDate: '2026-03-01',
  purchasePrice: { amountMinor: 389900, currency: 'NZD' },
  status: 'owned',
}

const body: GearFields = {
  category: 'camera-body',
  brand: 'Fujifilm',
  model: 'X-T4',
  mount: 'fujifilm-x',
  purchaseDate: '2021-06-15',
  status: 'sold',
  saleDate: '2026-09-20',
  salePrice: { amountMinor: 120000, currency: 'NZD' },
}

const bag: GearFields = {
  category: 'bag',
  brand: 'Peak Design',
  model: 'Everyday Backpack 20L',
  status: 'lent-out',
}

/** The list page at a path, with the three items above already saved */
async function renderList(path = '/gear') {
  const services = testServices()
  for (const fields of [lens, body, bag]) await services.repositories.gear.add(fields)
  const view = renderApp(path, services)
  await screen.findByRole('table')
  return view
}

/** The item names in the table, top to bottom */
function tableOrder(): string[] {
  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
  return rows.map((row) => within(row).getByRole('link').textContent)
}

const count = () => screen.getByRole('status')

describe('gear list', () => {
  it('lists every item in a table, in name order, with its details', async () => {
    await renderList()
    expect(tableOrder()).toEqual([
      'Fujifilm X-T4',
      'Peak Design Everyday Backpack 20L',
      'Sony FE 24-70mm F2.8 GM II',
    ])
    const row = screen.getByRole('row', { name: /Sony FE 24-70mm/ })
    expect(within(row).getByRole('rowheader')).toHaveTextContent(
      'Sony FE 24-70mm F2.8 GM IIWorkhorse',
    )
    const cells = within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
    expect(cells).toEqual(['Lens', 'Owned', 'Sony E (including FE)', '1 Mar 2026', '$3,899.00'])
  })

  it('shows the same items as cards for small screens', async () => {
    await renderList()
    const cards = within(screen.getByRole('list', { name: 'Your gear' })).getAllByRole('listitem')
    expect(cards.map((card) => within(card).getByRole('link').textContent)).toEqual([
      'Fujifilm X-T4',
      'Peak Design Everyday Backpack 20L',
      'Sony FE 24-70mm F2.8 GM II',
    ])
  })

  it('counts what is showing out of everything', async () => {
    await renderList()
    expect(count()).toHaveTextContent('Showing 3 of 3')
  })

  it('searches as you type, keeping the search in the address', async () => {
    const user = userEvent.setup()
    const { router } = await renderList()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'sony')
    expect(tableOrder()).toEqual(['Sony FE 24-70mm F2.8 GM II'])
    expect(count()).toHaveTextContent('Showing 1 of 3')
    expect(router.state.location.search).toEqual({ q: 'sony' })
  })

  it.each([
    ['Category', 'Camera body', { category: 'camera-body' }, ['Fujifilm X-T4']],
    ['Status', 'Lent out', { status: 'lent-out' }, ['Peak Design Everyday Backpack 20L']],
    ['Mount', 'Sony E (including FE)', { mount: 'sony-e' }, ['Sony FE 24-70mm F2.8 GM II']],
  ])('filters by %s, keeping the filter in the address', async (filter, choice, search, order) => {
    const user = userEvent.setup()
    const { router } = await renderList()
    await user.selectOptions(screen.getByRole('combobox', { name: filter }), choice)
    expect(tableOrder()).toEqual(order)
    expect(router.state.location.search).toEqual(search)
  })

  it('reads filters from the address, dropping any that make no sense', async () => {
    await renderList('/gear?status=sold&category=spaceship&sort=price')
    expect(tableOrder()).toEqual(['Fujifilm X-T4'])
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('sold')
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('')
  })

  it('clears every filter at once', async () => {
    const user = userEvent.setup()
    const { router } = await renderList('/gear?q=sony&status=owned')
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('sony')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(tableOrder()).toHaveLength(3)
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
    expect(router.state.location.search).toEqual({})
  })

  it('sorts by a column, marks it, and reverses it on a second click', async () => {
    const user = userEvent.setup()
    const { router } = await renderList()
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )

    await user.click(screen.getByRole('button', { name: 'Purchase date' }))
    expect(tableOrder()).toEqual([
      'Fujifilm X-T4',
      'Sony FE 24-70mm F2.8 GM II',
      'Peak Design Everyday Backpack 20L',
    ])
    expect(screen.getByRole('columnheader', { name: 'Purchase date' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    expect(screen.getByRole('columnheader', { name: 'Name' })).not.toHaveAttribute('aria-sort')

    await user.click(screen.getByRole('button', { name: 'Purchase date' }))
    expect(tableOrder()).toEqual([
      'Sony FE 24-70mm F2.8 GM II',
      'Fujifilm X-T4',
      'Peak Design Everyday Backpack 20L',
    ])
    expect(screen.getByRole('columnheader', { name: 'Purchase date' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    expect(router.state.location.search).toEqual({ sort: 'purchaseDate', desc: true })
  })

  it('sorts from the sort menu as well', async () => {
    const user = userEvent.setup()
    const { router } = await renderList()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Status, A to Z')
    expect(tableOrder()).toEqual([
      'Peak Design Everyday Backpack 20L',
      'Sony FE 24-70mm F2.8 GM II',
      'Fujifilm X-T4',
    ])
    expect(router.state.location.search).toEqual({ sort: 'status' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Name, A to Z')
    expect(router.state.location.search).toEqual({})
  })

  it('says when nothing matches, and offers to clear the filters', async () => {
    const user = userEvent.setup()
    await renderList()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'hasselblad')
    expect(screen.getByText('No gear matches these filters.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(count()).toHaveTextContent('Showing 0 of 3')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(tableOrder()).toHaveLength(3)
  })

  it('explains when there is no gear yet', async () => {
    renderApp('/gear')
    expect(await screen.findByText("You haven't added any gear yet.")).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('opens an item from the list', async () => {
    const user = userEvent.setup()
    await renderList()
    await user.click(within(screen.getByRole('table')).getByRole('link', { name: 'Fujifilm X-T4' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Fujifilm X-T4' }),
    ).toBeInTheDocument()
  })
})
