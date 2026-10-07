// The system map page: each camera's lenses and how they fit, the focal lengths it covers and the
// gaps, what each adapter unlocks, the lenses no camera here can take, and the empty states.
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GearFields } from '@/core/gear'
import { renderApp, testServices } from './support'

const z6: GearFields = {
  category: 'camera-body',
  brand: 'Nikon',
  model: 'Z6 III',
  mount: 'nikon-z',
  sensorFormat: 'full-frame',
  status: 'owned',
}
const zoom: GearFields = {
  category: 'lens',
  brand: 'Nikon',
  model: 'Z 24-70mm f/4 S',
  mount: 'nikon-z',
  lensCoverage: 'full-frame',
  focalLengthMin: 24,
  focalLengthMax: 70,
  maxAperture: 4,
  status: 'owned',
}
const dx: GearFields = {
  category: 'lens',
  brand: 'Nikon',
  model: 'Z DX 16-50mm',
  mount: 'nikon-z',
  lensCoverage: 'aps-c',
  focalLengthMin: 16,
  focalLengthMax: 50,
  status: 'owned',
}
const fifty: GearFields = {
  category: 'lens',
  brand: 'Nikon',
  model: 'AF-S 50mm f/1.8G',
  mount: 'nikon-f',
  focalLengthMin: 50,
  focalLengthMax: 50,
  status: 'owned',
}
const tele: GearFields = {
  category: 'lens',
  brand: 'Nikon',
  model: 'Z 180-600mm',
  mount: 'nikon-z',
  focalLengthMin: 180,
  focalLengthMax: 600,
  status: 'owned',
}
const ftz: GearFields = {
  category: 'mount-adapter',
  brand: 'Nikon',
  model: 'FTZ II',
  adapterFrom: 'nikon-f',
  adapterTo: 'nikon-z',
  adapterAutofocus: false,
  status: 'owned',
}
const m42: GearFields = {
  category: 'mount-adapter',
  brand: 'Fotodiox',
  model: 'M42 to Z',
  adapterFrom: 'm42',
  adapterTo: 'nikon-z',
  status: 'owned',
}
const rf: GearFields = {
  category: 'lens',
  brand: 'Canon',
  model: 'RF 50mm',
  mount: 'canon-rf',
  status: 'owned',
}
const mystery: GearFields = {
  category: 'lens',
  brand: 'Old',
  model: 'Mystery 35mm',
  status: 'owned',
}
const plainZoom: GearFields = {
  category: 'lens',
  brand: 'Nikon',
  model: 'Z 24-70mm f/4 S',
  mount: 'nikon-z',
  status: 'owned',
}
const noMount: GearFields = {
  category: 'camera-body',
  brand: 'Nikon',
  model: 'Z6 III',
  status: 'owned',
}

async function renderMap(gear: readonly GearFields[]) {
  const services = testServices()
  for (const fields of gear) await services.repositories.gear.add(fields)
  renderApp('/system', services)
  await screen.findByRole('heading', { level: 1, name: 'System map' })
}

/** Each row's text in a region's first list */
function rows(region: string) {
  const [list] = within(screen.getByRole('region', { name: region })).getAllByRole('list')
  if (list === undefined) throw new Error(`No list in ${region}`)
  return within(list)
    .getAllByRole('listitem')
    .map((row) => row.textContent)
}

describe('the system map', () => {
  it('lists each camera with its lenses and how they fit, by focal length', async () => {
    await renderMap([z6, zoom, dx, fifty, tele, ftz])
    expect(rows('Nikon Z6 III')).toEqual([
      'Nikon Z 24-70mm f/4 SFits. 24-70mm f/4',
      'Nikon Z DX 16-50mmFits, cropped to APS-C. 16-50mm, frames like 24-75mm here',
      'Nikon AF-S 50mm f/1.8GWith your Nikon FTZ II, manual focus only. 50mm',
      'Nikon Z 180-600mmFits. 180-600mm',
    ])
  })

  it('says what focal lengths each camera covers, and where the gaps are', async () => {
    await renderMap([z6, zoom, dx, fifty, tele, ftz])
    const camera = screen.getByRole('region', { name: 'Nikon Z6 III' })
    expect(camera).toHaveTextContent('From 24mm to 600mm. Nothing between 75mm and 180mm.')
    // The strips repeat the words above for the eye, so screen readers skip them
    const strips = camera.querySelectorAll('svg')
    expect(strips.length).toBeGreaterThan(0)
    for (const strip of strips) expect(strip).toHaveAttribute('aria-hidden', 'true')
  })

  it.each<[string, readonly GearFields[], string]>([
    [
      'lenses with no focal lengths',
      [z6, plainZoom],
      'Add focal lengths to its lenses to see what it covers.',
    ],
    ['no lenses that fit', [z6, rf], 'None of your lenses fit it yet.'],
    ['no mount', [noMount, zoom], 'Add its mount to see which lenses it takes.'],
    ['a single prime', [z6, { ...zoom, focalLengthMax: 24 }], 'Covers 24mm.'],
  ])('says so for a camera with %s', async (_name, gear, text) => {
    await renderMap(gear)
    expect(screen.getByRole('region', { name: 'Nikon Z6 III' })).toHaveTextContent(text)
  })

  it('says what each adapter unlocks, or that it unlocks nothing yet', async () => {
    await renderMap([z6, fifty, ftz, m42])
    const adapters = within(screen.getByRole('region', { name: 'Adapters' }))
    expect(
      adapters.getByText('Brings your Nikon AF-S 50mm f/1.8G to your Nikon Z6 III.'),
    ).toBeVisible()
    expect(adapters.getByText('Nothing yet: none of your lenses need it.')).toBeVisible()
  })

  it('lists the lenses no camera here can take, and why', async () => {
    await renderMap([z6, fifty, rf, mystery])
    expect(rows('Lenses no camera here can take')).toEqual([
      'Canon RF 50mmNo adapter brings it to a camera you have.',
      'Nikon AF-S 50mm f/1.8GAn adapter would bring it to a camera you have.',
      "Old Mystery 35mmA mount isn't recorded, so this can't be worked out.",
    ])
  })

  it('asks for a camera when there are only lenses', async () => {
    await renderMap([zoom])
    expect(
      screen.getByText('No camera bodies yet. Add one to see which of your lenses it takes.'),
    ).toBeVisible()
    expect(rows('Lenses no camera here can take')).toEqual([
      'Nikon Z 24-70mm f/4 SAdd a camera body to see what it works with.',
    ])
  })

  it('has an empty state before there are any cameras or lenses', async () => {
    await renderMap([])
    expect(screen.getByText('Nothing to map yet.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Add gear' })).toBeInTheDocument()
  })
})
