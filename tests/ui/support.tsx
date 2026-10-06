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
import type { Services } from '@/ui/services'

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

/** Services on a new, empty database, which a test can fill before rendering */
export function testServices(connection: ConnectionStatus = fakeConnection().status): Services {
  const db = new BodycapDatabase({ indexedDB: new IDBFactory(), IDBKeyRange })
  return { repositories: createRepositories(db), connection }
}

/** Renders the app at a path, as if typed into the address bar */
export function renderApp(path = '/', services: Services = testServices()) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  const view = render(<App router={router} services={services} />)
  return { ...view, router, services }
}
