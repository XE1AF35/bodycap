// What a screen shows when it has nothing to list: a small line drawing, the message, and what to
// do next. The drawings are decoration, so screen readers skip them, and they're drawn with SVG
// attributes rather than inline styles, which the content security policy blocks.
import type { ReactNode } from 'react'

// Two decimal places is already finer than a screen can show
const coordinate = (value: number) => String(Number(value.toFixed(2)))

// The knurled grip around a body cap's edge: 30 short ticks, one every 12 degrees
const GRIP = Array.from({ length: 30 }, (_, tick) => {
  const angle = (tick * 12 * Math.PI) / 180
  const point = (radius: number) =>
    `${coordinate(40 + radius * Math.sin(angle))} ${coordinate(40 - radius * Math.cos(angle))}`
  return `M${point(30)}L${point(33)}`
}).join('')

const DRAWINGS = {
  // A body cap from the front, with the index dot that lines up with the camera's mount
  'body-cap': (
    <>
      <circle cx="40" cy="40" r="30" />
      <circle cx="40" cy="40" r="21" />
      <path d={GRIP} />
      <circle cx="40" cy="14.5" r="2" className="fill-signal" stroke="none" />
    </>
  ),
  // An empty 3:2 frame, with only the focus point lit
  viewfinder: (
    <>
      <path d="M10 28V20h8M62 20h8v8M70 52v8h-8M18 60h-8v-8" />
      <rect x="34" y="34" width="12" height="12" rx="1" />
      <circle cx="40" cy="40" r="1.75" className="fill-signal" stroke="none" />
    </>
  ),
  // A split-image focusing screen: the line breaks at the split because nothing is in focus
  'out-of-focus': (
    <>
      <circle cx="40" cy="40" r="30" />
      <circle cx="40" cy="40" r="16" />
      <path d="M24 40h32M37 24.28V40M43 40v15.72" />
      <circle cx="40" cy="10" r="2" className="fill-signal" stroke="none" />
    </>
  ),
}

export function EmptyState({
  drawing,
  title,
  children,
  actions,
}: {
  readonly drawing: keyof typeof DRAWINGS
  /** One short sentence, with a little personality */
  readonly title: string
  readonly children?: ReactNode
  readonly actions?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center motion-safe:animate-rise-in">
      <svg
        viewBox="0 0 80 80"
        aria-hidden="true"
        className="size-20 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {DRAWINGS[drawing]}
      </svg>
      <p className="font-medium">{title}</p>
      {children !== undefined && (
        <div className="grid max-w-sm gap-2 text-sm text-muted-foreground">{children}</div>
      )}
      {actions !== undefined && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
      )}
    </div>
  )
}
