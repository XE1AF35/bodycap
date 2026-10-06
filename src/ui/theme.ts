// The colour theme. It lives in localStorage rather than IndexedDB because public/theme-init.js
// has to read it before the first paint, and it stays on this device: backups leave it out.
// The class on <html> is the source of truth, and dark is the default.
import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

/** Also read by public/theme-init.js, so change both together */
export const THEME_KEY = 'bodycap:theme'

const listeners = new Set<() => void>()

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Storage can be blocked. The theme still changes, just for this visit.
  }
  for (const listener of listeners) listener()
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme)
}
