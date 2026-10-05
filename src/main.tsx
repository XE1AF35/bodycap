import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/ui/App'

const root = document.getElementById('root')
if (!root) {
  throw new Error('Glassbox could not start: index.html has no #root element.')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
