// Reads a repository's live query in a component, which re-renders whenever the data changes.
import { useMemo, useSyncExternalStore } from 'react'
import type { Live } from '@/data/repositories'

export type LiveState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: T }
  | { readonly status: 'error'; readonly error: unknown }

interface LiveStore<T> {
  readonly subscribe: (onChange: () => void) => () => void
  readonly getSnapshot: () => LiveState<T>
}

// useSyncExternalStore reads the latest state synchronously, so it's kept here between updates
function createStore<T>(live: Live<T>): LiveStore<T> {
  let state: LiveState<T> = { status: 'loading' }
  return {
    subscribe: (onChange) =>
      live.subscribe(
        (value) => {
          state = { status: 'ready', value }
          onChange()
        },
        (error) => {
          state = { status: 'error', error }
          onChange()
        },
      ),
    getSnapshot: () => state,
  }
}

/**
 * The current state of a live query. Pass the same Live each render (from useMemo, or created
 * outside the component), or the query restarts every time.
 */
export function useLive<T>(live: Live<T>): LiveState<T> {
  const store = useMemo(() => createStore(live), [live])
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/**
 * Passes on only the first value. A form uses this so a change made elsewhere, even a delete,
 * never replaces what someone is in the middle of typing.
 */
export function firstValue<T>(live: Live<T>): Live<T> {
  return {
    subscribe(next, error) {
      let delivered = false
      return live.subscribe((value) => {
        if (delivered) return
        delivered = true
        next(value)
      }, error)
    },
  }
}
