// Starts Bodycap: opens storage, builds the router, and renders the app.
// First, before anything that creates a Zod schema
import './zod-config'
import { createHashHistory } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { watchConnection } from '@/data/connection'
import { BodycapDatabase } from '@/data/db'
import { createRepositories } from '@/data/dexie-repositories'
import { createStorageHelpers } from '@/data/storage'
import { createAppRouter } from '@/router'
import { App } from '@/ui/App'
import { compressPhoto } from '@/ui/photos/compress'
import { createInstallOffer } from '@/ui/pwa/install-offer'
import { registerServiceWorker } from '@/ui/pwa/register'
import { createUpdateOffer } from '@/ui/pwa/update-offer'
import './index.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Bodycap could not start: index.html has no #root element.')
}

const db = new BodycapDatabase()
const services = {
  repositories: createRepositories(db),
  connection: watchConnection(db),
  storage: createStorageHelpers(navigator.storage),
  updates: createUpdateOffer(),
  // Listening from the start, as the browser may offer before the app has rendered
  install: createInstallOffer(window),
  compressPhoto: (file: File) => compressPhoto(file),
}
const router = createAppRouter(createHashHistory())

// The development server has no service worker, so it's only registered in the built app
if (import.meta.env.PROD) registerServiceWorker(services.updates)

createRoot(root).render(
  <StrictMode>
    <App router={router} services={services} />
  </StrictMode>,
)
