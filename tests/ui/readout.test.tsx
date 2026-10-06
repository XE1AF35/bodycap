// The spec readout: labels and values as a description list, leaving out anything blank.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Readout } from '@/ui/components/Readout'

const text = (elements: readonly HTMLElement[]) => elements.map((element) => element.textContent)

describe('Readout', () => {
  it('pairs each label with its value, as a term and its definition', () => {
    render(
      <Readout
        rows={[
          { label: 'Serial number', value: '4521987', data: true },
          { label: 'Condition', value: 'Like new' },
        ]}
      />,
    )
    expect(text(screen.getAllByRole('term'))).toEqual(['Serial number', 'Condition'])
    expect(text(screen.getAllByRole('definition'))).toEqual(['4521987', 'Like new'])
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['false', false],
    ['an empty string', ''],
  ])('leaves out a row whose value is %s', (_, value) => {
    render(
      <Readout
        rows={[
          { label: 'Brand', value: 'Sony' },
          { label: 'Nickname', value },
        ]}
      />,
    )
    expect(text(screen.getAllByRole('term'))).toEqual(['Brand'])
  })

  it('keeps a value of zero, which is a real value', () => {
    render(<Readout rows={[{ label: 'Lenses', value: 0, data: true }]} />)
    expect(screen.getByRole('definition')).toHaveTextContent('0')
  })

  it('shows nothing at all when every value is blank', () => {
    const { container } = render(<Readout rows={[{ label: 'Nickname', value: undefined }]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('sets data in the monospaced font, and words in the body font', () => {
    render(
      <Readout
        rows={[
          { label: 'Serial number', value: '4521987', data: true },
          { label: 'Condition', value: 'Like new' },
        ]}
      />,
    )
    expect(screen.getByText('4521987')).toHaveClass('font-mono')
    expect(screen.getByText('Like new')).not.toHaveClass('font-mono')
  })
})
