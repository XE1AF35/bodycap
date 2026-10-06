// The first tab stop on every page, for skipping past the header to the content.
import type { MouseEvent } from 'react'

export const MAIN_ID = 'main'

// With hash routing, letting the browser follow #main would be read as a page address, so focus
// moves by script instead
function skipToMain(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
  document.getElementById(MAIN_ID)?.focus()
}

export function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      onClick={skipToMain}
      className="sr-only rounded-md bg-popover px-3 py-2 font-medium text-popover-foreground shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
    >
      Skip to main content
    </a>
  )
}
