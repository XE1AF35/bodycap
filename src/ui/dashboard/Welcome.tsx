// What someone sees before they've added anything: what Bodycap is, and the two ways to start.
import { Link } from '@tanstack/react-router'
import { Page } from '@/ui/components/Page'
import { buttonVariants } from '@/ui/components/ui/button-variants'

export function Welcome() {
  return (
    <Page title="Welcome to Bodycap">
      <div className="grid max-w-prose gap-4">
        <p>
          Keep track of your camera gear: what you have, what it's worth, its serial numbers,
          warranties, and where it is.
        </p>
        <p className="text-muted-foreground">
          Everything stays in this browser and nothing is sent anywhere, so make a backup now and
          then to keep it safe.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/gear/new" className={buttonVariants()}>
            Add your first item
          </Link>
          <Link to="/settings" className={buttonVariants({ variant: 'outline' })}>
            Restore from a backup
          </Link>
        </div>
      </div>
    </Page>
  )
}
