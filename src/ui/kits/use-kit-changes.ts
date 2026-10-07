// A kit as shown, changing as soon as a box is ticked rather than once storage says it's saved, so
// ticks and switches never flick back. Whenever the saved kit changes, it's shown as saved again.
import { useState } from 'react'
import type { Kit, KitFields } from '@/core/kits'
import { useServices } from '@/ui/services'

export function useKitChanges(saved: Kit) {
  const { repositories } = useServices()
  const [shown, setShown] = useState(saved)
  const [last, setLast] = useState(saved)
  // React's way to reset state when a prop changes, without an effect and a second render
  if (last !== saved) {
    setLast(saved)
    setShown(saved)
  }

  return {
    kit: shown,
    /** Applies a kit rule now, and saves it to the kit as stored */
    change: (apply: (kit: Kit) => KitFields): Promise<Kit> => {
      setShown((current) => ({ ...current, ...apply(current) }))
      return repositories.kits.update(saved.id, apply)
    },
  }
}

export type KitChange = ReturnType<typeof useKitChanges>['change']
