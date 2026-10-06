// Shown for an address that matches no page, such as an old bookmark.
import { Link } from '@tanstack/react-router'
import { Page } from '@/ui/components/Page'

export function NotFoundPage() {
  return (
    <Page title="Page not found">
      <p className="mb-4 text-muted-foreground">There's nothing at this address.</p>
      <Link to="/" className="font-medium underline underline-offset-4">
        Go to the dashboard
      </Link>
    </Page>
  )
}
