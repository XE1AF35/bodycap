// The browser's offer to install Bodycap as an app, kept from start-up so a button can use it
// later. Only Chromium browsers make the offer, with a beforeinstallprompt event. Elsewhere people
// install from the browser's own menu, so there's no button.

/** The part of Chromium's BeforeInstallPromptEvent that Bodycap uses, as the DOM types lack it */
interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>
}

function isInstallPrompt(event: Event): event is InstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function'
}

export interface InstallOffer {
  /** Asks the browser to install Bodycap, while it can. Shaped for useSyncExternalStore. */
  readonly current: () => (() => Promise<void>) | undefined
  readonly subscribe: (listener: () => void) => () => void
}

/** Listens on the window given, or offers nothing without one */
export function createInstallOffer(browser: EventTarget | undefined): InstallOffer {
  let install: (() => Promise<void>) | undefined
  const listeners = new Set<() => void>()
  const set = (next: typeof install) => {
    install = next
    for (const listener of listeners) listener()
  }

  browser?.addEventListener('beforeinstallprompt', (event) => {
    if (!isInstallPrompt(event)) return
    // Keeps the browser's own install bar away, so the offer comes from the button
    event.preventDefault()
    set(async () => {
      // A prompt can be shown once, whatever the person chooses. The browser offers again later.
      set(undefined)
      await event.prompt()
    })
  })
  browser?.addEventListener('appinstalled', () => {
    set(undefined)
  })

  return {
    current: () => install,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
