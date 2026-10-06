// The theme toggle: dark by default, switching to light and back, and remembering the choice.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from './support'

const root = document.documentElement

beforeEach(() => {
  // index.html starts the page dark, and public/theme-init.js removes it for a saved light theme
  root.className = 'dark'
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('theme toggle', () => {
  it('starts dark, with the toggle pressed', async () => {
    renderApp()
    const toggle = await screen.findByRole('button', { name: 'Dark theme' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches to light and back, remembering each choice', async () => {
    const user = userEvent.setup()
    renderApp()
    const toggle = await screen.findByRole('button', { name: 'Dark theme' })

    await user.click(toggle)
    expect(root).not.toHaveClass('dark')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem('bodycap:theme')).toBe('light')

    await user.click(toggle)
    expect(root).toHaveClass('dark')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('bodycap:theme')).toBe('dark')
  })

  it('shows the light theme that was applied before the app loaded', async () => {
    root.className = ''
    renderApp()
    const toggle = await screen.findByRole('button', { name: 'Dark theme' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('still switches when the browser blocks storage', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError')
    })
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Dark theme' }))
    expect(root).not.toHaveClass('dark')
  })
})
