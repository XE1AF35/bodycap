// The frame around every page: skip link, header, and the main landmark with any storage notice.
import { Outlet, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { SiteHeader } from '@/ui/components/SiteHeader'
import { MAIN_ID, SkipLink } from '@/ui/components/SkipLink'
import { StorageNotice } from '@/ui/components/StorageNotice'
import { NavigationCountContext } from '@/ui/navigation-focus'

export function Layout() {
  const router = useRouter()
  const [navigations, setNavigations] = useState(0)

  useEffect(
    () =>
      router.subscribe('onResolved', ({ fromLocation, pathChanged }) => {
        // Only a new page counts: a filter changing the search part of the address mustn't pull
        // focus away from the filter
        if (fromLocation !== undefined && pathChanged) {
          setNavigations((count) => count + 1)
        }
      }),
    [router],
  )

  return (
    <NavigationCountContext value={navigations}>
      <SkipLink />
      <SiteHeader />
      <main id={MAIN_ID} tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 outline-none">
        <StorageNotice />
        <Outlet />
      </main>
    </NavigationCountContext>
  )
}
