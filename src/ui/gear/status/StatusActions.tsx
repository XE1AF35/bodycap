// The buttons that move an item through its lifecycle, shown on its page. Only the changes the
// lifecycle allows from the item's status are offered.
//
// The bar keeps track of the open dialog itself, so a dialog stays open while the item's status
// changes underneath it. Once a change is saved, focus moves to the bar, which is always there,
// since the button that was pressed has often gone; the status line says what changed. After
// Cancel, focus goes back to the button pressed.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { toIsoDate } from '@/core/dates'
import { STATUS_LABELS, type Gear, type Status } from '@/core/gear'
import { RuleError } from '@/data/repositories'
import { Button } from '@/ui/components/ui/button'
import { gearName } from '@/ui/gear/labels'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import type { ChangeProps } from './change-props'
import { ConfirmChange } from './ConfirmChange'
import { LendDialog } from './LendDialog'
import { LostDialog } from './LostDialog'
import { ReturnDialog } from './ReturnDialog'
import { SoldDialog } from './SoldDialog'
import { saveStatusChange } from './status-change'

type Action = 'lend' | 'return' | 'confirm' | 'sold' | 'lost'

interface Confirmation {
  readonly to: 'owned' | 'in-repair'
  readonly trigger: string
  readonly title: string
  readonly description: string
}

function confirmationFor(item: Gear): Confirmation | undefined {
  const name = gearName(item)
  switch (item.status) {
    case 'owned':
      return {
        to: 'in-repair',
        trigger: 'Repair',
        title: `Send ${name} for repair?`,
        description: "It stays in your gear, marked as in repair until it's back.",
      }
    case 'in-repair':
      return {
        to: 'owned',
        trigger: 'Back from repair',
        title: `Is ${name} back from repair?`,
        description: "It's marked as owned again.",
      }
    case 'wishlist':
      return {
        to: 'owned',
        trigger: 'Bought it',
        title: `Did you buy ${name}?`,
        description:
          'It moves from your wishlist into your gear. Edit it to add when you bought it and what you paid.',
      }
    case 'sold':
      return {
        to: 'owned',
        trigger: 'Own it again',
        title: `Own ${name} again?`,
        description: 'It goes back into your gear, and its sale date and price are cleared.',
      }
    case 'lost':
      return {
        to: 'owned',
        trigger: 'Found it',
        title: `Found ${name}?`,
        description: 'It goes back into your gear, and the date it was lost is cleared.',
      }
    case 'lent-out':
      return undefined
  }
}

/** The buttons offered from each status, in the order they're shown */
function actionsFor(status: Status): readonly Action[] {
  switch (status) {
    case 'owned':
      return ['lend', 'confirm', 'sold', 'lost']
    case 'lent-out':
      return ['return', 'lost']
    case 'in-repair':
      return ['confirm', 'sold', 'lost']
    case 'wishlist':
    case 'sold':
    case 'lost':
      return ['confirm']
  }
}

const LABELS: Record<Exclude<Action, 'confirm'>, string> = {
  lend: 'Lend',
  return: 'Returned',
  sold: 'Sold',
  lost: 'Lost',
}

export function StatusActions({ item }: { readonly item: Gear }) {
  const { repositories } = useServices()
  // Loaded with the bar, so Returned knows the loan by the time it's pressed
  const loans = useLive(useMemo(() => repositories.loans.forGear(item.id), [repositories, item.id]))
  // Read once, which is close enough for dates typed while the page is open
  const [today] = useState(() => toIsoDate(new Date()))
  const labelId = useId()
  const barRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const focusNextRef = useRef<'bar' | 'opener' | null>(null)
  // The confirmation is kept from when it opened, so its words don't change if the status does
  const [open, setOpen] = useState<{
    readonly action: Action
    readonly confirmation?: Confirmation | undefined
  } | null>(null)
  const [message, setMessage] = useState('')

  // Once a dialog has gone, focus goes where it should: the bar after a change, the button after
  // Cancel, or the bar if that button has gone meanwhile
  useEffect(() => {
    if (open !== null || focusNextRef.current === null) return
    const opener = openerRef.current
    const target =
      focusNextRef.current === 'opener' && opener?.isConnected ? opener : barRef.current
    focusNextRef.current = null
    target?.focus()
  })

  const props: ChangeProps = {
    item,
    today,
    onDone: (done) => {
      setMessage(done)
      focusNextRef.current = 'bar'
      setOpen(null)
    },
    onCancel: () => {
      focusNextRef.current = 'opener'
      setOpen(null)
    },
  }

  const confirmation = confirmationFor(item)
  const button = (action: Action): ReactNode => {
    const label = action === 'confirm' ? confirmation?.trigger : LABELS[action]
    if (label === undefined) return null
    return (
      <Button
        key={action}
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        onClick={(event) => {
          openerRef.current = event.currentTarget
          setOpen({ action, confirmation: action === 'confirm' ? confirmation : undefined })
        }}
      >
        {label}
      </Button>
    )
  }

  const confirming = open?.confirmation

  return (
    <div className="mb-8">
      <div
        ref={barRef}
        role="group"
        aria-labelledby={labelId}
        tabIndex={-1}
        className="flex flex-wrap items-center gap-2"
      >
        <span id={labelId} className="label-engraved mr-2">
          Change status
        </span>
        {actionsFor(item.status).map(button)}
      </div>
      <p role="status" className="mt-2 text-sm text-muted-foreground">
        {message}
      </p>

      {open?.action === 'lend' && <LendDialog {...props} />}
      {open?.action === 'return' && <ReturnDialog {...props} loans={loans} />}
      {open?.action === 'sold' && <SoldDialog {...props} />}
      {open?.action === 'lost' && <LostDialog {...props} />}
      {confirming !== undefined && (
        <ConfirmChange
          title={confirming.title}
          description={confirming.description}
          confirm={`Mark as ${STATUS_LABELS[confirming.to].toLowerCase()}`}
          onCancel={props.onCancel}
          onConfirm={async () => {
            const { to } = confirming
            const errors = await saveStatusChange(repositories.gear, item, { to }, today)
            if (errors !== undefined) throw new RuleError(Object.values(errors).join(' '))
            props.onDone(`Marked as ${STATUS_LABELS[to].toLowerCase()}.`)
          }}
        />
      )}
    </div>
  )
}
