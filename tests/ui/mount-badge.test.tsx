// The mount badge: a short code on screen, and the mount's full name for screen readers.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Gear } from '@/core/gear'
import { MOUNT_CODES, MOUNT_LABELS, MOUNTS } from '@/core/mounts'
import { MountBadge } from '@/ui/gear/MountBadge'

/** The badge in a table cell, as in the gear list. A cell is named by what's inside it. */
function renderInCell(gear: Pick<Gear, 'mount' | 'adapterFrom' | 'adapterTo'>) {
  render(
    <table>
      <tbody>
        <tr>
          <td>
            <MountBadge gear={gear} />
          </td>
        </tr>
      </tbody>
    </table>,
  )
  return screen.getByRole('cell')
}

describe('MountBadge', () => {
  it.each(MOUNTS)(
    'shows %s as its short code, and names it in full for screen readers',
    (mount) => {
      const cell = renderInCell({ mount })
      expect(screen.getByText(MOUNT_CODES[mount])).toBeVisible()
      expect(cell).toHaveAccessibleName(`Mount: ${MOUNT_LABELS[mount]}`)
    },
  )

  it('shows both sides of an adapter, lens side first', () => {
    const cell = renderInCell({ adapterFrom: 'nikon-f', adapterTo: 'nikon-z' })
    expect(cell).toHaveTextContent(/^FZ/)
    expect(cell).toHaveAccessibleName('Adapter: Nikon F to Nikon Z')
  })

  it.each([
    ['gear with no mount, such as a tripod', {}],
    ['an adapter with only one side recorded', { adapterFrom: 'nikon-f' }],
  ] as const)('shows nothing for %s', (_, gear) => {
    const cell = renderInCell(gear)
    expect(cell).toBeEmptyDOMElement()
  })
})
