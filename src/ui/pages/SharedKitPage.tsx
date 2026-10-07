// A kit someone shared as a link, shown read only. Nothing is saved unless the person ticks some of
// its gear and adds it to their wishlist, all at once. Gear already here starts unticked.
import { Link, useParams } from '@tanstack/react-router'
import { useId, useMemo, useState } from 'react'
import { toIsoDate } from '@/core/dates'
import { CATEGORY_LABELS, type Gear, type GearFields } from '@/core/gear'
import { formatMoney } from '@/core/money'
import { formatAperture, formatFocalLength } from '@/core/optics'
import { matchingGear, openSharedKit, type SharedKit } from '@/core/share'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { Button } from '@/ui/components/ui/button'
import { buttonVariants } from '@/ui/components/ui/button-variants'
import { gearName } from '@/ui/gear/labels'
import { MountBadge } from '@/ui/gear/MountBadge'
import { saveProblem } from '@/ui/gear/save-problem'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'
import { itemCount } from '@/ui/settings/words'

/** The price, and whether it's here already, said after the item's name */
function hintFor(item: GearFields, match: Gear | undefined): string | undefined {
  const parts: string[] = []
  if (item.purchasePrice !== undefined) parts.push(`Price: ${formatMoney(item.purchasePrice)}`)
  if (match !== undefined) {
    parts.push(match.status === 'wishlist' ? 'Already on your wishlist' : 'Already in your gear')
  }
  return parts.length === 0 ? undefined : parts.join('. ')
}

/** Such as "Lens, 33mm f/1.4" */
function SharedItemRow({
  item,
  match,
  hintId,
  chosen,
  onChoose,
}: {
  readonly item: GearFields
  readonly match: Gear | undefined
  readonly hintId: string
  readonly chosen: boolean
  readonly onChoose: (chosen: boolean) => void
}) {
  const hint = hintFor(item, match)
  const optics = [formatFocalLength(item), formatAperture(item)].filter(
    (part) => part !== undefined,
  )
  return (
    <li className="grid gap-1 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-w-0 items-center gap-3 font-medium">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={chosen}
            aria-describedby={hint === undefined ? undefined : hintId}
            onChange={(event) => {
              onChoose(event.target.checked)
            }}
          />
          {gearName(item)}
        </label>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{CATEGORY_LABELS[item.category]}</span>
          {optics.length > 0 && <span className="font-mono">{optics.join(' ')}</span>}
          <MountBadge gear={item} />
        </div>
      </div>
      {hint !== undefined && (
        <p id={hintId} className="ml-8 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {item.notes !== undefined && <p className="ml-8 text-sm whitespace-pre-wrap">{item.notes}</p>}
    </li>
  )
}

function SharedKitView({ kit, gear }: { readonly kit: SharedKit; readonly gear: readonly Gear[] }) {
  const { repositories, storage } = useServices()
  const baseId = useId()
  // Shared items have no IDs, and two can be the same model, so each is known by its place in the
  // kit. The list never changes while it's shown: a new link starts a new page.
  const [entries] = useState(() =>
    kit.items.map((item, place) => ({ id: `${baseId}-${String(place)}`, item })),
  )
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        entries.filter(({ item }) => matchingGear(item, gear) === undefined).map(({ id }) => id),
      ),
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState<string>()

  const add = async () => {
    setBusy(true)
    setProblem(undefined)
    try {
      const added = await repositories.gear.addAll(
        entries.filter(({ id }) => chosen.has(id)).map(({ item }) => item),
      )
      setChosen(new Set())
      setMessage(`Added ${itemCount(added.length)} to your wishlist.`)
      void storage.requestPersistence()
    } catch (error) {
      setProblem(saveProblem(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page
      title={kit.name}
      description={
        <div className="grid gap-1 text-sm">
          <p className="text-muted-foreground">
            A copy of a kit someone shared with you. None of it is in your gear unless you add it.
          </p>
          {kit.description !== undefined && (
            <p className="whitespace-pre-wrap">{kit.description}</p>
          )}
        </div>
      }
    >
      <section aria-labelledby={`${baseId}-title`} className="mb-6 max-w-3xl">
        <h2 id={`${baseId}-title`} className="mb-1 text-base font-semibold">
          In this kit
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Tick what you'd like, then add it to your wishlist.
        </p>
        <ul className="grid gap-2">
          {entries.map(({ id, item }) => (
            <SharedItemRow
              key={id}
              item={item}
              match={matchingGear(item, gear)}
              hintId={`${id}-hint`}
              chosen={chosen.has(id)}
              onChoose={(on) => {
                setChosen((previous) => {
                  const next = new Set(previous)
                  if (on) next.add(id)
                  else next.delete(id)
                  return next
                })
              }}
            />
          ))}
        </ul>
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={busy || chosen.size === 0}
          onClick={() => {
            void add()
          }}
        >
          Add to my wishlist
        </Button>
        {message !== '' && (
          <Link
            to="/gear"
            search={{ status: 'wishlist' }}
            className={buttonVariants({ variant: 'ghost' })}
          >
            See your wishlist
          </Link>
        )}
      </div>
      <p role="status" className="mt-3 text-sm">
        {message}
      </p>
      {problem !== undefined && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {problem}
        </p>
      )}
    </Page>
  )
}

export function SharedKitPage() {
  const { kit: link } = useParams({ from: '/shared/$kit' })
  const { repositories } = useServices()
  // Read once, which is close enough for the dates the gear rules check
  const [today] = useState(() => toIsoDate(new Date()))
  const shared = useMemo(() => openSharedKit(link, today), [link, today])
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))

  if (!shared.ok) {
    return (
      <Page title="This link can't be opened">
        <EmptyState
          drawing="out-of-focus"
          title="Nothing to see here."
          actions={
            <Link to="/" className={buttonVariants({ variant: 'outline' })}>
              Go to your dashboard
            </Link>
          }
        >
          {shared.error}
        </EmptyState>
      </Page>
    )
  }
  if (gear.status === 'loading') {
    return <p className="text-muted-foreground">Loading the kit.</p>
  }
  if (gear.status === 'error') {
    return (
      <Page title={shared.value.name}>
        <p role="alert">Your gear couldn't be loaded. Reload the page to try again.</p>
      </Page>
    )
  }
  // A new link starts afresh, with its own ticks
  return <SharedKitView key={link} kit={shared.value} gear={gear.value} />
}
