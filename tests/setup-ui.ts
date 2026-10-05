// Shared setup for UI tests: DOM matchers such as toBeInTheDocument, a clean DOM after each test,
// and fake-indexeddb for components that read storage (see setup-data.ts for why it's global).
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without globals, so Testing Library can't register its own automatic cleanup
afterEach(() => {
  cleanup()
})
