// The autocomplete field: free text that suggests matches as you type, picked by keyboard or pointer.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Autocomplete } from '@/ui/components/ui/autocomplete'

interface Fruit {
  readonly id: string
  readonly name: string
  readonly colour: string
}

const FRUIT: readonly Fruit[] = [
  { id: 'apple', name: 'Apple', colour: 'Red' },
  { id: 'apricot', name: 'Apricot', colour: 'Orange' },
  { id: 'banana', name: 'Banana', colour: 'Yellow' },
]

function Harness({ onPick }: { readonly onPick: (fruit: Fruit) => void }) {
  const [text, setText] = useState('')
  const found =
    text.length < 2
      ? []
      : FRUIT.filter(({ name }) => name.toLowerCase().startsWith(text.toLowerCase()))
  return (
    <>
      <label htmlFor="fruit">Fruit</label>
      <Autocomplete
        id="fruit"
        value={text}
        onValueChange={setText}
        items={found}
        itemKey={(fruit) => fruit.id}
        itemText={(fruit) => fruit.name}
        renderItem={(fruit) => (
          <>
            {fruit.name} <span>{fruit.colour}</span>
          </>
        )}
        onPick={onPick}
        status={text.length < 2 ? '' : `${String(found.length)} found`}
        empty="Nothing matches."
      />
    </>
  )
}

function setup() {
  const onPick = vi.fn<(fruit: Fruit) => void>()
  render(<Harness onPick={onPick} />)
  return { onPick, user: userEvent.setup(), input: screen.getByRole('combobox', { name: 'Fruit' }) }
}

describe('Autocomplete', () => {
  it('suggests matches as you type', async () => {
    const { user, input } = setup()
    await user.type(input, 'ap')
    const options = await screen.findAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Apple Red', 'Apricot Orange'])
    expect(await screen.findByText('2 found')).toHaveAttribute('role', 'status')
  })

  it('picks with the arrow keys and Enter, keeping focus in the field', async () => {
    const { user, input, onPick } = setup()
    await user.type(input, 'ap')
    await screen.findAllByRole('option')
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onPick).toHaveBeenCalledWith(FRUIT[1])
    expect(input).toHaveValue('Apricot')
    expect(input).toHaveFocus()
  })

  it('points the field at the highlighted option', async () => {
    const { user, input } = setup()
    await user.type(input, 'ap')
    await screen.findAllByRole('option')
    await user.keyboard('{ArrowDown}')
    const highlighted = screen.getByRole('option', { name: 'Apple Red' })
    expect(input).toHaveAttribute('aria-activedescendant', highlighted.id)
  })

  it('picks with a click', async () => {
    const { user, input, onPick } = setup()
    await user.type(input, 'ba')
    await user.click(await screen.findByRole('option', { name: 'Banana Yellow' }))
    expect(onPick).toHaveBeenCalledWith(FRUIT[2])
    expect(input).toHaveValue('Banana')
  })

  it('closes on Escape and keeps the text as typed', async () => {
    const { user, input, onPick } = setup()
    await user.type(input, 'apr')
    await screen.findAllByRole('option')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(input).toHaveValue('apr')
    expect(onPick).not.toHaveBeenCalled()
  })

  it('says when nothing matches, and keeps the text', async () => {
    const { user, input } = setup()
    await user.type(input, 'kiwi')
    expect(await screen.findByText('Nothing matches.')).toHaveAttribute('role', 'status')
    // Said once, not also as "0 found"
    expect(screen.queryByText('0 found')).not.toBeInTheDocument()
    expect(input).toHaveValue('kiwi')
  })

  it('stays quiet until there is something to suggest', async () => {
    const { user, input } = setup()
    await user.type(input, 'a')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
