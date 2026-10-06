// Shown for an address that matches no page, such as an old bookmark.
import { Link } from '@tanstack/react-router'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { buttonVariants } from '@/ui/components/ui/button-variants'

export function NotFoundPage() {
  return (
    <Page title="Page not found">
      <EmptyState
        drawing="out-of-focus"
        title="This page is out of focus."
        actions={
          <Link to="/" className={buttonVariants({ variant: 'outline' })}>
            Go to the dashboard
          </Link>
        }
      >
        There's nothing at this address. It may be from an old bookmark.
      </EmptyState>
    </Page>
  )
}
