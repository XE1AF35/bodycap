// The useLive hook: loading, values, errors, unsubscribing, and a component reading live data.
import { act, render, renderHook, screen } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { BodycapDatabase } from '@/data/db'
import { createRepositories } from '@/data/dexie-repositories'
import type { Live } from '@/data/repositories'
import { useLive } from '@/ui/hooks/useLive'

/** A live query whose values the test sends by hand */
function manualLive<T>() {
  let next: ((value: T) => void) | undefined
  let fail: ((error: unknown) => void) | undefined
  let active = 0
  const live: Live<T> = {
    subscribe(onNext, onError) {
      next = onNext
      fail = onError
      active += 1
      return () => {
        active -= 1
      }
    },
  }
  return {
    live,
    send: (value: T) => {
      act(() => next?.(value))
    },
    fail: (error: unknown) => {
      act(() => fail?.(error))
    },
    active: () => active,
  }
}

describe('useLive', () => {
  it('starts loading, then shows each value as it arrives', () => {
    const query = manualLive<number>()
    const { result } = renderHook(() => useLive(query.live))
    expect(result.current).toEqual({ status: 'loading' })
    query.send(1)
    expect(result.current).toEqual({ status: 'ready', value: 1 })
    query.send(2)
    expect(result.current).toEqual({ status: 'ready', value: 2 })
  })

  it('reports an error from the query', () => {
    const query = manualLive<number>()
    const { result } = renderHook(() => useLive(query.live))
    const error = new Error('Storage is unavailable')
    query.fail(error)
    expect(result.current).toEqual({ status: 'error', error })
  })

  it('stops listening when the component goes away', () => {
    const query = manualLive<number>()
    const { unmount } = renderHook(() => useLive(query.live))
    expect(query.active()).toBe(1)
    unmount()
    expect(query.active()).toBe(0)
  })

  it('switches to a new query, starting from loading', () => {
    const first = manualLive<string>()
    const second = manualLive<string>()
    const { result, rerender } = renderHook(({ live }) => useLive(live), {
      initialProps: { live: first.live },
    })
    first.send('first')
    rerender({ live: second.live })
    expect(result.current).toEqual({ status: 'loading' })
    expect(first.active()).toBe(0)
    second.send('second')
    expect(result.current).toEqual({ status: 'ready', value: 'second' })
  })
})

describe('useLive with IndexedDB', () => {
  const db = new BodycapDatabase({ indexedDB: new IDBFactory(), IDBKeyRange })
  const repos = createRepositories(db)
  const list = repos.gear.list()

  afterEach(() => {
    db.close()
  })

  function GearModels() {
    const gear = useLive(list)
    if (gear.status !== 'ready') return <p>Loading</p>
    return (
      <ul>
        {gear.value.map(({ id, model }) => (
          <li key={id}>{model}</li>
        ))}
      </ul>
    )
  }

  it('shows the gear list and updates it when an item is added', async () => {
    render(<GearModels />)
    expect(await screen.findByRole('list')).toBeEmptyDOMElement()
    await repos.gear.add({
      category: 'camera-body',
      brand: 'Fujifilm',
      model: 'X-T5',
      status: 'owned',
    })
    expect(await screen.findByRole('listitem')).toHaveTextContent('X-T5')
  })
})
