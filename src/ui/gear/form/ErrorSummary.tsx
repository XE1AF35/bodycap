// The list of problems at the top of the form after a save that didn't go through. Each links to
// its field. Focus moves here, so a screen reader reads the problems straight away.
import type { Ref } from 'react'

export interface Problem {
  /** The id of the control to fix */
  readonly id: string
  readonly message: string
}

// With hash routing, letting the browser follow #gear-brand would be read as a page address, so
// focus moves by script instead
function focusField(id: string) {
  document.getElementById(id)?.focus()
}

export function ErrorSummary({
  problems,
  ref,
}: {
  readonly problems: readonly Problem[]
  readonly ref: Ref<HTMLDivElement>
}) {
  if (problems.length === 0) return null
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby="error-summary-title"
      className="rounded-lg border-2 border-destructive bg-card p-4"
    >
      <h2 id="error-summary-title" className="mb-2 text-lg font-semibold">
        There's a problem
      </h2>
      <ul className="grid gap-1">
        {problems.map(({ id, message }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="font-medium text-destructive underline underline-offset-4"
              onClick={(event) => {
                event.preventDefault()
                focusField(id)
              }}
            >
              {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
