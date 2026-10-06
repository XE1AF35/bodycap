// Starts Bodycap: opens storage, builds the router, and renders the app.
import { createHashHistory } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { watchConnection } from '@/data/connection'
import { BodycapDatabase } from '@/data/db'
import { createRepositories } from '@/data/dexie-repositories'
import { createAppRouter } from '@/router'
import { App } from '@/ui/App'
import './index.css'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Bodycap could not start: index.html has no #root element.')
}

const db = new BodycapDatabase()
const services = { repositories: createRepositories(db), connection: watchConnection(db) }
const router = createAppRouter(createHashHistory())

createRoot(root).render(
  <StrictMode>
    <App router={router} services={services} />
  </StrictMode>,
)
