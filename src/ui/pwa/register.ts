// Registers the service worker that makes Bodycap work offline. This replaces vite-plugin-pwa's own
// registration, which passes a plain string where Trusted Types requires an approved URL.
import { Workbox } from 'workbox-window'
import { SCHEMA_VERSION } from '@/data/schema-version'
import { changesStorage } from '@/ui/pwa/schema-check'
import type { UpdateOffer } from '@/ui/pwa/update-offer'
import { approveWorkerUrl } from '@/ui/pwa/worker-policy'

export function registerServiceWorker(updates: UpdateOffer): void {
  if (!('serviceWorker' in navigator)) return
  const scope = import.meta.env.BASE_URL
  const workbox = new Workbox(approveWorkerUrl(`${scope}sw.js`, window.trustedTypes), { scope })

  const install = () => {
    // Reload once the new version has taken over, which only happens because the person asked
    workbox.addEventListener('controlling', () => {
      window.location.reload()
    })
    workbox.messageSkipWaiting()
  }
  workbox.addEventListener('waiting', () => {
    // No-store, so the answer is the published file rather than one the browser kept
    const versionFile = () => fetch(`${scope}version.json`, { cache: 'no-store' })
    void changesStorage(versionFile, SCHEMA_VERSION).then((changes) => {
      updates.offer({ install, changesStorage: changes })
    })
  })
  void workbox.register()
}
