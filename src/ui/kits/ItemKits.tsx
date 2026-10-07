// The kits an item is in, on its page, each linking to the kit. Nothing shows for an item in none.
import { Link } from '@tanstack/react-router'
import { useId, useMemo } from 'react'
import type { Gear } from '@/core/gear'
import { LOCALE } from '@/core/locale'
import { useLive } from '@/ui/hooks/useLive'
import { useServices } from '@/ui/services'

const names = new Intl.Collator(LOCALE)

export function ItemKits({ item }: { readonly item: Gear }) {
  const { repositories } = useServices()
  const kits = useLive(useMemo(() => repositories.kits.withGear(item.id), [repositories, item.id]))
  const titleId = useId()
  if (kits.status !== 'ready' || kits.value.length === 0) return null

  return (
    <section aria-labelledby={titleId} className="mb-8">
      <h2 id={titleId} className="mb-3 text-base font-semibold">
        Kits
      </h2>
      <ul className="flex flex-wrap gap-2">
        {[...kits.value]
          .sort((a, b) => names.compare(a.name, b.name))
          .map((kit) => (
            <li key={kit.id}>
              <Link
                to="/kits/$kitId"
                params={{ kitId: kit.id }}
                className="inline-flex rounded-full border border-input px-3 py-1 text-sm hover:bg-muted"
              >
                {kit.name}
              </Link>
            </li>
          ))}
      </ul>
    </section>
  )
}
