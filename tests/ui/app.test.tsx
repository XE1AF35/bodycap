// Smoke test: the app renders its name, which proves the toolchain (TSX, aliases, jsdom) works.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '@/ui/App'

describe('App', () => {
  it('shows the Glassbox heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Glassbox' })).toBeInTheDocument()
  })
})
