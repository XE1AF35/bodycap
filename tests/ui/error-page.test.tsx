// The error page: a plain explanation, a way to reload, and the details for anyone reporting it.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ErrorPage } from '@/ui/pages/ErrorPage'

describe('ErrorPage', () => {
  it('explains that something went wrong, offers a reload, and keeps the details', () => {
    render(<ErrorPage error={new Error('Cannot read the lens list')} reset={() => undefined} />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/your saved gear is safe/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByText('Cannot read the lens list')).toBeInTheDocument()
    expect(document.title).toBe('Something went wrong | Bodycap')
  })

  it('shows details for something thrown that is not an Error', () => {
    render(<ErrorPage error="The disk is on fire" reset={() => undefined} />)
    expect(screen.getByText('The disk is on fire')).toBeInTheDocument()
  })
})
