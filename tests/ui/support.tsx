// Helpers for UI tests: the whole app on an in-memory address bar and fake-indexeddb, and a
// connection status the test controls.
import { createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import type { ConnectionProblem, ConnectionStatus } from '@/data/connection'
import { BodycapDatabase } from '@/data/db'
import { createRepositories } from '@/data/dexie-repositories'
import { createAppRouter } from '@/router'
import { App } from '@/ui/App'

/** A connection status whose problems the test reports by hand */
export function fakeConnection(initial?: ConnectionProblem) {
  let problem = initial
  const listeners = new Set<() => void>()
  const status: ConnectionStatus = {
    current: () => problem,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return {
    status,
    report: (next: ConnectionProblem) => {
      problem = next
      for (const listener of listeners) listener()
    },
  }
}

/** Renders the app at a path, with its own empty database */
export function renderApp(path = '/', connection: ConnectionStatus = fakeConnection().status) {
  const db = new BodycapDatabase({ indexedDB: new IDBFactory(), IDBKeyRange })
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  const view = render(
    <App router={router} services={{ repositories: createRepositories(db), connection }} />,
  )
  return { ...view, router, db }
}
