// Watches the database connection for problems the person needs to hear about: storage that won't
// open (some private windows), a newer Bodycap in another tab, or an old tab holding up an update.
import type { BodycapDatabase } from './db'

export type ConnectionProblem = 'unavailable' | 'updated-elsewhere' | 'update-blocked'

/** Shaped for useSyncExternalStore */
export interface ConnectionStatus {
  readonly current: () => ConnectionProblem | undefined
  readonly subscribe: (listener: () => void) => () => void
}

/** Starts opening the database and reports what goes wrong. Call once, when the app starts. */
export function watchConnection(db: BodycapDatabase): ConnectionStatus {
  let problem: ConnectionProblem | undefined
  const listeners = new Set<() => void>()
  const report = (next: ConnectionProblem) => {
    problem = next
    for (const listener of listeners) listener()
  }

  // Dexie then closes this tab's connection, so the other tab's upgrade can go ahead
  db.on('versionchange', () => {
    report('updated-elsewhere')
  })
  db.on('blocked', () => {
    report('update-blocked')
  })
  db.open().catch(() => {
    report('unavailable')
  })

  return {
    current: () => problem,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
