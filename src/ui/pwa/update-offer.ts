// A newer Bodycap waiting to take over. The service worker never takes over by itself, so a
// half-filled form is never lost: the prompt waits until the person chooses to reload.

export interface Update {
  readonly install: () => void
  /** The new version upgrades the database, so a backup first is worth suggesting */
  readonly changesStorage: boolean
}

export interface UpdateOffer {
  /** The waiting version, once there is one. Shaped for useSyncExternalStore. */
  readonly current: () => Update | undefined
  readonly subscribe: (listener: () => void) => () => void
  readonly offer: (update: Update) => void
}

export function createUpdateOffer(): UpdateOffer {
  let waiting: Update | undefined
  const listeners = new Set<() => void>()
  return {
    current: () => waiting,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    offer: (next) => {
      waiting = next
      for (const listener of listeners) listener()
    },
  }
}
