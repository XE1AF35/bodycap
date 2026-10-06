// Every page's frame: its one h1 with any actions beside it, the window title ("Gear | Bodycap"),
// and focus on the heading after moving to it from another page.
import { use, useEffect, useRef, type ReactNode } from 'react'
import { NavigationCountContext } from '@/ui/navigation-focus'

interface PageProps {
  readonly title: string
  /** The page's main buttons or links, such as Add gear, shown beside the heading */
  readonly actions?: ReactNode
  readonly children?: ReactNode
}

export function Page({ title, actions, children }: PageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const navigations = use(NavigationCountContext)

  useEffect(() => {
    document.title = `${title} | Bodycap`
  }, [title])

  useEffect(() => {
    if (navigations > 0) headingRef.current?.focus()
  }, [navigations])

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        {/* Focusable from script only, so it isn't an extra tab stop */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-title font-semibold tracking-tight outline-none"
        >
          {title}
        </h1>
        {actions !== undefined && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </>
  )
}
