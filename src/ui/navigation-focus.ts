// Counts moves to a new page, so each page's heading knows when to take focus. A screen reader then
// starts reading the new page, as it would after a full page load. The first page shown counts as
// 0, so opening the app doesn't steal focus.
import { createContext } from 'react'

export const NavigationCountContext = createContext(0)
