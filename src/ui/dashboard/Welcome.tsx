// What someone sees before they've added anything: what Bodycap is, and the two ways to start.
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { buttonVariants } from '@/ui/components/ui/button-variants'

export function Welcome() {
  return (
    <Page title="Welcome to Bodycap">
      <EmptyState
        drawing="body-cap"
        title="Every kit starts with one body."
        actions={
          <>
            <Link to="/gear/new" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              Add your first item
            </Link>
            <Link to="/settings" className={buttonVariants({ variant: 'outline' })}>
              Restore from a backup
            </Link>
          </>
        }
      >
        <p>
          Keep track of your camera gear: what you have, what it's worth, its serial numbers,
          warranties, and where it is.
        </p>
        <p>
          Everything stays in this browser and nothing is sent anywhere, so make a backup now and
          then to keep it safe.
        </p>
      </EmptyState>
    </Page>
  )
}
