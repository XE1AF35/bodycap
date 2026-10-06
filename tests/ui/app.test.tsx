// The app shell: navigation and the current page, page titles, focus after navigating, the skip
// link, the phone menu, the not-found page, and storage problems.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeConnection, renderApp } from './support'

const heading = (name: string) => screen.findByRole('heading', { level: 1, name })

describe('app shell', () => {
  it('shows the Bodycap name and the dashboard first', async () => {
    renderApp()
    expect(await heading('Dashboard')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveTextContent('Bodycap')
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it.each([
    ['/', 'Dashboard'],
    ['/gear', 'Gear'],
    ['/settings', 'Settings'],
  ])('marks %s as the current page, and titles the window after it', async (path, name) => {
    renderApp(path)
    await heading(name)
    const links = within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link')
    const current = links.filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current.map((link) => link.textContent)).toEqual([name])
    expect(document.title).toBe(`${name} | Bodycap`)
  })

  it('moves focus to the new heading after navigating, but leaves it alone on first load', async () => {
    const user = userEvent.setup()
    renderApp()
    expect(await heading('Dashboard')).not.toHaveFocus()
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
    await heading('Dashboard')
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
    expect(document.title).toBe('Page not found | Bodycap')
    await user.click(screen.getByRole('link', { name: 'Go to the dashboard' }))
    expect(await heading('Dashboard')).toBeInTheDocument()
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
    renderApp('/', fakeConnection(problem).status)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('offers a reload once another tab has updated Bodycap', async () => {
    renderApp('/', fakeConnection('updated-elsewhere').status)
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('says nothing while storage is fine, and speaks up as soon as a problem starts', async () => {
    const connection = fakeConnection()
    renderApp('/', connection.status)
    await heading('Dashboard')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    act(() => {
      connection.report('updated-elsewhere')
    })
    expect(screen.getByRole('alert')).toHaveTextContent('updated in another tab')
  })
})
