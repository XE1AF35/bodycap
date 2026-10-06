// Shown when a page fails in a way the app didn't expect. Saved data lives in IndexedDB, apart
// from the page, so it's safe to say so and offer a reload.
import type { ErrorComponentProps } from '@tanstack/react-router'
import { EmptyState } from '@/ui/components/EmptyState'
import { Button } from '@/ui/components/ui/button'
import { Page } from '@/ui/components/Page'

export function ErrorPage({ error }: ErrorComponentProps) {
  const details = error instanceof Error ? error.message : String(error)
  return (
    <Page title="Something went wrong">
      <EmptyState
        drawing="out-of-focus"
        title="Your saved gear is safe."
        actions={
          <Button
            onClick={() => {
              window.location.reload()
            }}
          >
            Reload
          </Button>
        }
      >
        Bodycap hit a problem it didn't expect. Reloading usually fixes it.
      </EmptyState>
      <details className="mx-auto max-w-prose text-sm text-muted-foreground">
        <summary className="cursor-pointer">Details for reporting the problem</summary>
        <pre className="mt-2 font-mono whitespace-pre-wrap">{details}</pre>
      </details>
    </Page>
  )
}
