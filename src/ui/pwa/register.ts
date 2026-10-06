// Registers the service worker that makes Bodycap work offline. This replaces vite-plugin-pwa's own
// registration, which passes a plain string where Trusted Types requires an approved URL.
import { Workbox } from 'workbox-window'
import type { UpdateOffer } from '@/ui/pwa/update-offer'
import { approveWorkerUrl } from '@/ui/pwa/worker-policy'

export function registerServiceWorker(updates: UpdateOffer): void {
  if (!('serviceWorker' in navigator)) return
  const scope = import.meta.env.BASE_URL
  const workbox = new Workbox(approveWorkerUrl(`${scope}sw.js`, window.trustedTypes), { scope })

  workbox.addEventListener('waiting', () => {
    updates.offer(() => {
      // Reload once the new version has taken over, which only happens because the person asked
      workbox.addEventListener('controlling', () => {
        window.location.reload()
      })
      workbox.messageSkipWaiting()
    })
  })
  void workbox.register()
}
