// The buttons that move an item through its lifecycle, shown on its page. Only the changes the
// lifecycle allows from the item's status are offered. After one, focus comes back to this bar
// (its first button), since the button that was pressed has often gone, and the status line says
// what changed.
import { useEffect, useId, useRef, useState } from 'react'
import { toIsoDate } from '@/core/dates'
import { STATUS_LABELS, type Gear } from '@/core/gear'
import { RuleError } from '@/data/repositories'
import { gearName } from '@/ui/gear/labels'
import { useServices } from '@/ui/services'
import type { ChangeProps } from './change-props'
import { ConfirmChange } from './ConfirmChange'
import { LendDialog } from './LendDialog'
import { LostDialog } from './LostDialog'
import { ReturnDialog } from './ReturnDialog'
import { SoldDialog } from './SoldDialog'
import { saveStatusChange } from './status-change'

interface Confirmation {
  readonly to: 'owned' | 'in-repair'
  readonly trigger: string
  readonly title: string
  readonly description: string
}

function confirmations(item: Gear): Partial<Record<Gear['status'], Confirmation>> {
  const name = gearName(item)
  return {
    owned: {
      to: 'in-repair',
      trigger: 'Repair',
      title: `Send ${name} for repair?`,
      description: "It stays in your gear, marked as in repair until it's back.",
    },
    'in-repair': {
      to: 'owned',
      trigger: 'Back from repair',
      title: `Is ${name} back from repair?`,
      description: "It's marked as owned again.",
    },
    wishlist: {
      to: 'owned',
      trigger: 'Bought it',
      title: `Did you buy ${name}?`,
      description:
        'It moves from your wishlist into your gear. Edit it to add when you bought it and what you paid.',
    },
    sold: {
      to: 'owned',
      trigger: 'Own it again',
      title: `Own ${name} again?`,
      description: 'It goes back into your gear, and its sale date and price are cleared.',
    },
    lost: {
      to: 'owned',
      trigger: 'Found it',
      title: `Found ${name}?`,
      description: 'It goes back into your gear, and the date it was lost is cleared.',
    },
  }
}

export function StatusActions({ item }: { readonly item: Gear }) {
  const { repositories } = useServices()
  // Read once, which is close enough for dates typed while the page is open
  const [today] = useState(() => toIsoDate(new Date()))
  const barRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const [done, setDone] = useState({ message: '', changes: 0 })

  useEffect(() => {
    if (done.changes > 0) barRef.current?.focus()
  }, [done])

  const props: ChangeProps = {
    item,
    today,
    finalFocus: barRef,
    onDone: (message) => {
      setDone((previous) => ({ message, changes: previous.changes + 1 }))
    },
  }

  const confirmation = confirmations(item)[item.status]
  const confirm =
    confirmation === undefined ? null : (
      <ConfirmChange
        trigger={confirmation.trigger}
        title={confirmation.title}
        description={confirmation.description}
        confirm={`Mark as ${STATUS_LABELS[confirmation.to].toLowerCase()}`}
        finalFocus={barRef}
        onConfirm={async () => {
          const { to } = confirmation
          const errors = await saveStatusChange(repositories.gear, item, { to }, today)
          if (errors !== undefined) throw new RuleError(Object.values(errors).join(' '))
          props.onDone(`Marked as ${STATUS_LABELS[to].toLowerCase()}.`)
        }}
      />
    )

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
        {item.status === 'owned' && <LendDialog {...props} />}
        {item.status === 'lent-out' && <ReturnDialog {...props} />}
        {confirm}
        {(item.status === 'owned' || item.status === 'in-repair') && <SoldDialog {...props} />}
        {(item.status === 'owned' || item.status === 'lent-out' || item.status === 'in-repair') && (
          <LostDialog {...props} />
        )}
      </div>
      <p role="status" className="mt-2 text-sm text-muted-foreground">
        {done.message}
      </p>
    </div>
  )
}
