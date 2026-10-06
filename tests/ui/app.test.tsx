// The app shell: navigation and the current page, page titles, focus after navigating, the skip
// link, the phone menu, the not-found page, and storage problems.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeConnection, renderApp, testServices } from './support'

const heading = (name: string) => screen.findByRole('heading', { level: 1, name })

describe('app shell', () => {
  it('shows the Bodycap name and the dashboard first', async () => {
    renderApp()
    expect(await heading('Welcome to Bodycap')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveTextContent('Bodycap')
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it.each([
    ['/', 'Dashboard', 'Welcome to Bodycap'],
    ['/gear', 'Gear', 'Gear'],
    ['/settings', 'Settings', 'Settings'],
  ])('marks %s as the current page, and titles the window after it', async (path, link, title) => {
    renderApp(path)
    await heading(title)
    const links = within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link')
    const current = links.filter((item) => item.getAttribute('aria-current') === 'page')
    expect(current.map((item) => item.textContent)).toEqual([link])
    // The red dot sits beside the current page's link and no other
    expect(links.filter((item) => item.querySelector('.bg-signal') !== null)).toEqual(current)
    expect(document.title).toBe(`${title} | Bodycap`)
  })

  it('moves focus to the new heading after navigating, but leaves it alone on first load', async () => {
    const user = userEvent.setup()
    renderApp()
    expect(await heading('Welcome to Bodycap')).not.toHaveFocus()
    await user.click(screen.getByRole('link', { name: 'Gear' }))
    const gear = await heading('Gear')
    await waitFor(() => {
      expect(gear).toHaveFocus()
    })
  })

  it('skips to the main content without changing the address', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/gear')
    await heading('Gear')
    await user.tab()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('main')).toHaveFocus()
    expect(router.state.location.pathname).toBe('/gear')
  })

  it('opens the menu, and closes it after choosing a page', async () => {
    const user = userEvent.setup()
    renderApp()
    await heading('Welcome to Bodycap')
    const menu = screen.getByRole('button', { name: 'Menu' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    await user.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    await heading('Settings')
    expect(menu).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows a not-found page for an address that does not exist, with a way back', async () => {
    const user = userEvent.setup()
    renderApp('/lenses-i-dream-of')
    expect(await heading('Page not found')).toBeInTheDocument()
    expect(screen.getByText('This page is out of focus.')).toBeInTheDocument()
    expect(document.title).toBe('Page not found | Bodycap')
    await user.click(screen.getByRole('link', { name: 'Go to the dashboard' }))
    expect(await heading('Welcome to Bodycap')).toBeInTheDocument()
  })
})

describe('storage problems', () => {
  it.each([
    [
      'unavailable',
      "Bodycap can't save anything in this browser window. Private windows often block storage, so try a normal window.",
    ],
    ['updated-elsewhere', 'Bodycap was updated in another tab. Reload to carry on.'],
    ['update-blocked', 'Close other Bodycap tabs to finish updating.'],
  ] as const)('explains a %s problem as an alert', async (problem, message) => {
    renderApp('/', testServices({ connection: fakeConnection(problem).status }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('offers a reload once another tab has updated Bodycap', async () => {
    renderApp('/', testServices({ connection: fakeConnection('updated-elsewhere').status }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('says nothing while storage is fine, and speaks up as soon as a problem starts', async () => {
    const connection = fakeConnection()
    renderApp('/', testServices({ connection: connection.status }))
    await heading('Welcome to Bodycap')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    act(() => {
      connection.report('updated-elsewhere')
    })
    expect(screen.getByRole('alert')).toHaveTextContent('updated in another tab')
  })
})
