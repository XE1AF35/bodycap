// A newer Bodycap waiting to take over. The service worker never takes over by itself, so a
// half-filled form is never lost: the prompt waits until the person chooses to reload.

export interface UpdateOffer {
  /** How to install the waiting version, once one is waiting. Shaped for useSyncExternalStore. */
  readonly current: () => (() => void) | undefined
  readonly subscribe: (listener: () => void) => () => void
  readonly offer: (install: () => void) => void
}

export function createUpdateOffer(): UpdateOffer {
  let install: (() => void) | undefined
  const listeners = new Set<() => void>()
  return {
    current: () => install,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    offer: (next) => {
      install = next
      for (const listener of listeners) listener()
    },
  }
}
