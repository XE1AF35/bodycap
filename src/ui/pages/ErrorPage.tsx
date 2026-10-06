// Shown when a page fails in a way the app didn't expect. Saved data lives in IndexedDB, apart
// from the page, so it's safe to say so and offer a reload.
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/ui/components/ui/button'
import { Page } from '@/ui/components/Page'

export function ErrorPage({ error }: ErrorComponentProps) {
  const details = error instanceof Error ? error.message : String(error)
  return (
    <Page title="Something went wrong">
      <p className="mb-4 text-muted-foreground">
        Bodycap hit a problem it didn't expect. Your saved gear is safe. Reloading usually fixes it.
      </p>
      <Button
        onClick={() => {
          window.location.reload()
        }}
      >
        Reload
      </Button>
      <details className="mt-6 text-sm text-muted-foreground">
        <summary className="cursor-pointer">Details for reporting the problem</summary>
        <pre className="mt-2 whitespace-pre-wrap">{details}</pre>
      </details>
    </Page>
  )
}
