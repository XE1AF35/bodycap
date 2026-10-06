// A lens mount as a small capsule with the red index dot, like the mark lined up when fitting a
// lens. The short code is only for sighted people at a glance: screen readers hear the full name.
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Gear } from '@/core/gear'
import { MOUNT_CODES, MOUNT_LABELS } from '@/core/mounts'

function Capsule({ name, children }: { readonly name: string; readonly children: ReactNode }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-input px-2 font-mono text-xs font-medium whitespace-nowrap">
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-signal" />
        {children}
      </span>
      <span className="sr-only">{name}</span>
    </span>
  )
}

export function MountBadge({
  gear: { mount, adapterFrom, adapterTo },
}: {
  readonly gear: Pick<Gear, 'mount' | 'adapterFrom' | 'adapterTo'>
}) {
  if (mount !== undefined) {
    return <Capsule name={`Mount: ${MOUNT_LABELS[mount]}`}>{MOUNT_CODES[mount]}</Capsule>
  }
  if (adapterFrom !== undefined && adapterTo !== undefined) {
    return (
      <Capsule name={`Adapter: ${MOUNT_LABELS[adapterFrom]} to ${MOUNT_LABELS[adapterTo]}`}>
        {MOUNT_CODES[adapterFrom]}
        <ArrowRight className="size-3" />
        {MOUNT_CODES[adapterTo]}
      </Capsule>
    )
  }
  return null
}
