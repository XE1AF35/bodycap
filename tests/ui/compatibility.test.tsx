// The compatibility panel: on a lens, how it works with each camera you have, and on a body, with
// each lens, in words; a nudge when the mount is missing; and no panel for other gear.
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GearFields } from '@/core/gear'
import { renderApp, testServices } from './support'

const nikon = (
  fields: Partial<GearFields> & Pick<GearFields, 'category' | 'model'>,
): GearFields => ({
  brand: 'Nikon',
  status: 'owned',
  ...fields,
})

const z6 = nikon({
  category: 'camera-body',
  model: 'Z6 III',
  mount: 'nikon-z',
  sensorFormat: 'full-frame',
})
const z50 = nikon({
  category: 'camera-body',
  model: 'Z50 II',
  mount: 'nikon-z',
  sensorFormat: 'aps-c',
})
const sony: GearFields = {
  category: 'camera-body',
  brand: 'Sony',
  model: 'A7 IV',
  mount: 'sony-e',
  status: 'owned',
}
const canon: GearFields = {
  category: 'camera-body',
  brand: 'Canon',
  model: 'EOS R8',
  mount: 'canon-rf',
  status: 'owned',
}
const zoom = nikon({
  category: 'lens',
  model: 'Z 24-70mm',
  mount: 'nikon-z',
  lensCoverage: 'full-frame',
})
const dx = nikon({
  category: 'lens',
  model: 'Z DX 16-50mm',
  mount: 'nikon-z',
  lensCoverage: 'aps-c',
})
const fifty = nikon({ category: 'lens', model: 'AF-S 50mm', mount: 'nikon-f' })
const ftz = nikon({
  category: 'mount-adapter',
  model: 'FTZ',
  adapterFrom: 'nikon-f',
  adapterTo: 'nikon-z',
  adapterAutofocus: false,
})

/** The page of the item given, with all the gear above saved */
async function renderPage(
  fields: GearFields,
  others: readonly GearFields[] = [z6, z50, sony, canon, zoom, dx, fifty, ftz],
) {
  const services = testServices()
  for (const other of others) await services.repositories.gear.add(other)
  const item = await services.repositories.gear.add(fields)
  renderApp(`/gear/${item.id}`, services)
  await screen.findByRole('heading', { level: 1, name: `${fields.brand} ${fields.model}` })
}

/** Each row of the panel: the other item, and how the two work together */
async function rows(panelName: string) {
  const panel = await screen.findByRole('region', { name: panelName })
  return within(panel)
    .getAllByRole('listitem')
    .map((row) => [within(row).getByRole('link').textContent, row.lastElementChild?.textContent])
}

describe('the compatibility panel', () => {
  it('shows how a lens works with each camera, through an adapter you own if need be', async () => {
    await renderPage(nikon({ category: 'lens', model: 'AF-S 85mm', mount: 'nikon-f' }))
    expect(await rows('Works with your cameras')).toEqual([
      ['Nikon Z50 II', 'With your Nikon FTZ, manual focus only'],
      ['Nikon Z6 III', 'With your Nikon FTZ, manual focus only'],
      ['Canon EOS R8', 'Needs an adapter'],
      ['Sony A7 IV', 'Needs an adapter'],
    ])
  })

  it('shows how a body works with each lens, and which ones crop', async () => {
    await renderPage(
      nikon({ category: 'camera-body', model: 'Zf', mount: 'nikon-z', sensorFormat: 'full-frame' }),
    )
    expect(await rows('Works with your lenses')).toEqual([
      ['Nikon Z 24-70mm', 'Fits'],
      ['Nikon Z DX 16-50mm', 'Fits, cropped to APS-C'],
      ['Nikon AF-S 50mm', 'With your Nikon FTZ, manual focus only'],
    ])
  })

  it("says when a lens doesn't fit a camera at all", async () => {
    await renderPage(nikon({ category: 'lens', model: 'Z 40mm', mount: 'nikon-z' }))
    expect(await rows('Works with your cameras')).toContainEqual(['Canon EOS R8', "Doesn't fit"])
  })

  it('asks for the mount when it is missing', async () => {
    await renderPage(nikon({ category: 'lens', model: 'Mystery 35mm' }))
    const panel = await screen.findByRole('region', { name: 'Works with your cameras' })
    expect(panel).toHaveTextContent('Add its mount to see which of your cameras it works with.')
  })

  it('says when there is nothing to check against yet', async () => {
    await renderPage(zoom, [fifty])
    const panel = await screen.findByRole('region', { name: 'Works with your cameras' })
    expect(panel).toHaveTextContent("You don't have any cameras in Bodycap yet.")
  })

  it('has no panel for gear other than lenses and bodies', async () => {
    await renderPage(ftz)
    expect(screen.queryByRole('region', { name: /^Works with/ })).not.toBeInTheDocument()
  })
})
