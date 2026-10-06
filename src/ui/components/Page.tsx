// Every page's frame: its one h1, the window title ("Gear | Bodycap"), and focus on the heading
// after moving to it from another page.
import { use, useEffect, useRef, type ReactNode } from 'react'
import { NavigationCountContext } from '@/ui/navigation-focus'

interface PageProps {
  readonly title: string
  readonly children?: ReactNode
}

export function Page({ title, children }: PageProps) {
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
      {/* Focusable from script only, so it isn't an extra tab stop */}
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-6 border-b border-border pb-3 text-title font-semibold tracking-tight outline-none"
      >
        {title}
      </h1>
      {children}
    </>
  )
}
