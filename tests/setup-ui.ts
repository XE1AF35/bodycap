// Shared setup for UI tests: DOM matchers such as toBeInTheDocument, and a clean DOM after each test.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without globals, so Testing Library can't register its own automatic cleanup
afterEach(() => {
  cleanup()
})
