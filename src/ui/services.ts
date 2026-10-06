// What components reach storage through: the repositories and the connection status, provided
// once by App. Components never see Dexie itself.
import { createContext, use } from 'react'
import type { ConnectionStatus } from '@/data/connection'
import type { Repositories } from '@/data/repositories'

export interface Services {
  readonly repositories: Repositories
  readonly connection: ConnectionStatus
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices(): Services {
  const services = use(ServicesContext)
  if (services === null) {
    throw new Error('useServices needs a ServicesContext, which App provides.')
  }
  return services
}
