// The app's top: services for every component, then the router. main.tsx builds both, so tests can
// pass in their own.
import { RouterProvider } from '@tanstack/react-router'
import type { AppRouter } from '@/router'
import { ServicesContext, type Services } from '@/ui/services'

interface AppProps {
  readonly router: AppRouter
  readonly services: Services
}

export function App({ router, services }: AppProps) {
  return (
    <ServicesContext value={services}>
      <RouterProvider router={router} />
    </ServicesContext>
  )
}
