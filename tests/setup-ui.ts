// Shared setup for UI tests: DOM matchers such as toBeInTheDocument, a clean DOM after each test,
// fake-indexeddb for components that read storage (see setup-data.ts for why it's global), and
// every page's code loaded up front.
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import { createAppRouter } from '@/router'

// findBy and waitFor give up after 3 seconds rather than 1, for the same warm-up as testTimeout in
// vite.config.ts
configure({ asyncUtilTimeout: 3000 })

// Vitest runs without globals, so Testing Library can't register its own automatic cleanup
afterEach(() => {
  cleanup()
})

// Pages load their code on first visit. Loading it all before the tests start means the first test
// in a file isn't racing its time limit while that code compiles alongside other test files.
beforeAll(async () => {
  const router = createAppRouter(createMemoryHistory())
  await Promise.all(
    Object.values(router.routesById).map(
      (route) => router.loadRouteChunk(route) ?? Promise.resolve(),
    ),
  )
}, 30_000)
