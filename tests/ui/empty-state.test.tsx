// Empty states: a line drawing that screen readers skip, the message, and what to do next.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '@/ui/components/EmptyState'

describe('EmptyState', () => {
  it.each(['body-cap', 'viewfinder', 'out-of-focus'] as const)(
    'draws the %s as decoration, with no inline styles for the content security policy to block',
    (drawing) => {
      const { container } = render(<EmptyState drawing={drawing} title="Nothing here yet." />)
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      expect(container.querySelector('[style]')).toBeNull()
    },
  )

  it('shows the message, more detail, and what to do next', () => {
    render(
      <EmptyState
        drawing="body-cap"
        title="Nothing on the shelf yet."
        actions={<a href="#/gear/new">Add gear</a>}
      >
        Every kit starts with one body.
      </EmptyState>,
    )
    expect(screen.getByText('Nothing on the shelf yet.')).toBeVisible()
    expect(screen.getByText('Every kit starts with one body.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Add gear' })).toBeVisible()
  })

  it('shows only the message when there is nothing more to say', () => {
    const { container } = render(<EmptyState drawing="viewfinder" title="No gear matches." />)
    expect(container).toHaveTextContent(/^No gear matches\.$/)
  })
})
