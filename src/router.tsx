// The app's pages and their addresses. The app uses hash history (#/gear), because GitHub Pages
// can't send app addresses back to index.html. Each page loads its own code on first visit.
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  type RouterHistory,
} from '@tanstack/react-router'
import { gearSearchSchema } from '@/ui/gear/gear-search'
import { Layout } from '@/ui/Layout'
import { ErrorPage } from '@/ui/pages/ErrorPage'
import { NotFoundPage } from '@/ui/pages/NotFoundPage'

const rootRoute = createRootRoute({ component: Layout })

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('@/ui/pages/DashboardPage'), 'DashboardPage'),
})

const gearRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'gear',
  validateSearch: gearSearchSchema,
  component: lazyRouteComponent(() => import('@/ui/pages/GearPage'), 'GearPage'),
})

const addGearRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'gear/new',
  component: lazyRouteComponent(() => import('@/ui/pages/AddGearPage'), 'AddGearPage'),
})

const editGearRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'gear/$gearId/edit',
  component: lazyRouteComponent(() => import('@/ui/pages/EditGearPage'), 'EditGearPage'),
})

const gearDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'gear/$gearId',
  component: lazyRouteComponent(() => import('@/ui/pages/GearDetailPage'), 'GearDetailPage'),
})

const kitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'kits',
  component: lazyRouteComponent(() => import('@/ui/pages/KitsPage'), 'KitsPage'),
})

const kitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'kits/$kitId',
  component: lazyRouteComponent(() => import('@/ui/pages/KitPage'), 'KitPage'),
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
  component: lazyRouteComponent(() => import('@/ui/pages/SettingsPage'), 'SettingsPage'),
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  gearRoute,
  addGearRoute,
  gearDetailRoute,
  editGearRoute,
  kitsRoute,
  kitRoute,
  settingsRoute,
])

/** The browser gets hash history; tests pass in memory history. */
export function createAppRouter(history: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    // Rendered inside the layout, so the header and navigation stay usable
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
