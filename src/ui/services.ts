// What components reach the outside world through: the repositories, the connection status, the
// browser's storage manager, app updates, and installing, provided once by App. Components never see Dexie.
import { createContext, use } from 'react'
import type { ConnectionStatus } from '@/data/connection'
import type { Repositories } from '@/data/repositories'
import type { StorageHelpers } from '@/data/storage'
import type { InstallOffer } from '@/ui/pwa/install-offer'
import type { UpdateOffer } from '@/ui/pwa/update-offer'

export interface Services {
  readonly repositories: Repositories
  readonly connection: ConnectionStatus
  readonly storage: StorageHelpers
  readonly updates: UpdateOffer
  readonly install: InstallOffer
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices(): Services {
  const services = use(ServicesContext)
  if (services === null) {
    throw new Error('useServices needs a ServicesContext, which App provides.')
  }
  return services
}
