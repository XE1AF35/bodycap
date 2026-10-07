// The system map: how the gear you have fits together. Each camera with the lenses it takes, as
// they are or through an adapter, and a strip of the focal lengths it covers. Then what each
// adapter unlocks, and the lenses no camera here can take.
import { Link } from '@tanstack/react-router'
import { useId, useMemo } from 'react'
import type { Gear } from '@/core/gear'
import { LOCALE } from '@/core/locale'
import { SENSOR_FORMAT_LABELS } from '@/core/mounts'
import { formatAperture, formatFocalLength, formatMillimetres } from '@/core/optics'
import {
  systemMap,
  type AdapterMap,
  type BodyMap,
  type MappedLens,
  type UnreachableLens,
  type UnreachableReason,
} from '@/core/system-map'
import { EmptyState } from '@/ui/components/EmptyState'
import { Page } from '@/ui/components/Page'
import { buttonVariants } from '@/ui/components/ui/button-variants'
import { describeFit, FIT_DOTS } from '@/ui/gear/fit-words'
import { gearName } from '@/ui/gear/labels'
import { MountBadge } from '@/ui/gear/MountBadge'
import { useLive } from '@/ui/hooks/useLive'
import { cn } from '@/ui/lib/utils'
import { useServices } from '@/ui/services'
import { focalScale, type FocalScale } from '@/ui/system/focal-scale'
import { FocalAxis, LensBar } from '@/ui/system/FocalStrip'

const and = new Intl.ListFormat(LOCALE, { type: 'conjunction' })
const or = new Intl.ListFormat(LOCALE, { type: 'disjunction' })

// Each lens's words take the narrower column, and its strip the wider one, from tablets up
const ROW = 'grid gap-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:gap-4'

const REASONS: Record<UnreachableReason, string> = {
  'needs-adapter': 'An adapter would bring it to a camera you have.',
  incompatible: 'No adapter brings it to a camera you have.',
  unknown: "A mount isn't recorded, so this can't be worked out.",
  'no-camera': 'Add a camera body to see what it works with.',
}

function GearLink({ item, className }: { readonly item: Gear; readonly className?: string }) {
  return (
    <Link
      to="/gear/$gearId"
      params={{ gearId: item.id }}
      className={cn('underline-offset-4 hover:underline', className)}
    >
      {gearName(item)}
    </Link>
  )
}

/** Such as "From 16mm to 300mm. Nothing between 55mm and 150mm." */
function coverageText({ body, lenses, covered, gaps }: BodyMap): string {
  if (body.mount === undefined) return 'Add its mount to see which lenses it takes.'
  if (lenses.length === 0) return 'None of your lenses fit it yet.'
  const first = covered[0]
  const last = covered.at(-1)
  if (first === undefined || last === undefined) {
    return 'Add focal lengths to its lenses to see what it covers.'
  }
  if (first.min === last.max) return `Covers ${formatMillimetres(first.min)}.`
  const span = `From ${formatMillimetres(first.min)} to ${formatMillimetres(last.max)}.`
  if (gaps.length === 0) return span
  const between = gaps.map(
    ({ min, max }) => `between ${formatMillimetres(min)} and ${formatMillimetres(max)}`,
  )
  return `${span} Nothing ${or.format(between)}.`
}

/** How it fits, then its focal lengths, and how this camera frames them if it crops */
function lensWords({ lens, result, range }: MappedLens, gear: ReadonlyMap<string, Gear>): string {
  const optics = [formatFocalLength(lens), formatAperture(lens)].filter(
    (part) => part !== undefined,
  )
  const own = formatFocalLength(lens)
  const framed =
    range === undefined
      ? undefined
      : formatFocalLength({ focalLengthMin: range.min, focalLengthMax: range.max })
  const crop = framed !== undefined && framed !== own ? `, frames like ${framed} here` : ''
  const fit = `${describeFit(result, lens, gear)}.`
  return optics.length === 0 ? fit : `${fit} ${optics.join(' ')}${crop}`
}

function BodyCard({
  entry,
  scale,
  gear,
}: {
  readonly entry: BodyMap
  readonly scale: FocalScale | undefined
  readonly gear: ReadonlyMap<string, Gear>
}) {
  const titleId = useId()
  const { body, lenses, covered, gaps } = entry
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id={titleId} className="text-base font-semibold">
          <GearLink item={body} />
        </h2>
        <MountBadge gear={body} />
        {body.sensorFormat !== undefined && (
          <span className="text-sm text-muted-foreground">
            {SENSOR_FORMAT_LABELS[body.sensorFormat]}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{coverageText(entry)}</p>
      {lenses.length > 0 && (
        <ul className="mt-4 grid gap-3">
          {lenses.map((mapped) => (
            <li key={mapped.lens.id} className={ROW}>
              <div className="min-w-0">
                <GearLink item={mapped.lens} className="font-medium" />
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span
                    className={cn('size-2 shrink-0 rounded-full', FIT_DOTS[mapped.result.fit])}
                  />
                  {lensWords(mapped, gear)}
                </p>
              </div>
              {scale !== undefined && mapped.range !== undefined && (
                <LensBar
                  scale={scale}
                  range={mapped.range}
                  gaps={gaps}
                  adapted={mapped.result.fit === 'adapter'}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {scale !== undefined && covered.length > 0 && (
        <div className={cn(ROW, 'mt-1')}>
          <span className="hidden sm:block" />
          <FocalAxis scale={scale} gaps={gaps} />
        </div>
      )}
    </section>
  )
}

function AdaptersSection({ adapters }: { readonly adapters: readonly AdapterMap[] }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="mb-3 text-base font-semibold">
        Adapters
      </h2>
      <ul className="grid max-w-3xl gap-2">
        {adapters.map(({ adapter, complete, unlocks }) => (
          <li
            key={adapter.id}
            className="grid gap-1 rounded-lg border border-border bg-card px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <GearLink item={adapter} className="font-medium" />
              <MountBadge gear={adapter} />
            </div>
            {!complete ? (
              <p className="text-sm text-muted-foreground">
                Add both of its mounts to see what it unlocks.
              </p>
            ) : unlocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing yet: none of your lenses need it.
              </p>
            ) : (
              <ul className="grid gap-0.5 text-sm text-muted-foreground">
                {unlocks.map(({ lens, bodies }) => (
                  <li key={lens.id}>
                    Brings your {gearName(lens)} to your {and.format(bodies.map(gearName))}.
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function UnreachableSection({ lenses }: { readonly lenses: readonly UnreachableLens[] }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="mb-3 text-base font-semibold">
        Lenses no camera here can take
      </h2>
      <ul className="grid max-w-3xl gap-2">
        {lenses.map(({ lens, reason }) => (
          <li
            key={lens.id}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-4 py-3"
          >
            <GearLink item={lens} className="font-medium" />
            <span className="text-sm text-muted-foreground">{REASONS[reason]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SystemPage() {
  const { repositories } = useServices()
  const gear = useLive(useMemo(() => repositories.gear.list(), [repositories]))

  if (gear.status === 'loading') {
    return <p className="text-muted-foreground">Loading your gear.</p>
  }
  if (gear.status === 'error') {
    return (
      <Page title="System map">
        <p role="alert">Your gear couldn't be loaded. Reload the page to try again.</p>
      </Page>
    )
  }

  const map = systemMap(gear.value)
  if (map.bodies.length === 0 && map.unreachable.length === 0) {
    return (
      <Page title="System map">
        <EmptyState
          drawing="viewfinder"
          title="Nothing to map yet."
          actions={
            <Link to="/gear/new" className={buttonVariants()}>
              Add gear
            </Link>
          }
        >
          Add your camera bodies and lenses to see how they fit together.
        </EmptyState>
      </Page>
    )
  }

  const byId = new Map(gear.value.map((item) => [item.id, item]))
  // One scale for every camera, so their strips line up and compare
  const scale = focalScale(
    map.bodies.flatMap(({ lenses }) =>
      lenses.flatMap(({ range }) => (range === undefined ? [] : [range])),
    ),
  )
  return (
    <Page
      title="System map"
      description={
        <p className="max-w-prose text-sm text-muted-foreground">
          How the gear you have fits together. In each strip, a solid bar fits as it is, an outlined
          bar fits through an adapter you have, and a shaded band is a gap.
        </p>
      }
    >
      <div className="grid gap-6">
        {map.bodies.length === 0 ? (
          <p>No camera bodies yet. Add one to see which of your lenses it takes.</p>
        ) : (
          map.bodies.map((entry) => (
            <BodyCard key={entry.body.id} entry={entry} scale={scale} gear={byId} />
          ))
        )}
        {map.adapters.length > 0 && <AdaptersSection adapters={map.adapters} />}
        {map.unreachable.length > 0 && <UnreachableSection lenses={map.unreachable} />}
      </div>
    </Page>
  )
}
