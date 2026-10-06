// The status dot: each status in words, with a dot beside it that's only decoration.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { STATUS_LABELS, STATUSES } from '@/core/gear'
import { StatusDot } from '@/ui/gear/StatusDot'

describe('StatusDot', () => {
  it.each(STATUSES)('names %s in words, never by colour alone', (status) => {
    const { container } = render(<StatusDot status={status} />)
    expect(container.textContent).toBe(STATUS_LABELS[status])
  })

  it.each(STATUSES)('saves the red signal for lost gear (%s)', (status) => {
    const { container } = render(<StatusDot status={status} />)
    expect(container.querySelector('.bg-signal') !== null).toBe(status === 'lost')
  })
})
