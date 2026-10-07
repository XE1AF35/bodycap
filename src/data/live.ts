// Live queries: Dexie's liveQuery behind the repositories' own Live interface, so the UI never
// depends on Dexie directly.
import { liveQuery } from 'dexie'
import type { Live } from './repositories'

/** A query that runs again whenever the tables it read from change */
export function live<T>(query: () => Promise<T>): Live<T> {
  const observable = liveQuery(query)
  return {
    subscribe(next, error) {
      const subscription = observable.subscribe({ next, error })
      return () => {
        subscription.unsubscribe()
      }
    },
  }
}
