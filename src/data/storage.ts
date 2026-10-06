// The browser's storage manager: asking it to keep Bodycap's data, and how much space is used.
// Browsers differ in what they support, so any answer can be missing.
import type { StorageState } from '@/core/alerts'

/** The parts of navigator.storage used here. It's missing entirely outside secure contexts. */
export type StorageManagerLike = Partial<Pick<StorageManager, 'persist' | 'persisted' | 'estimate'>>

export interface StorageHelpers {
  /**
   * Asks the browser to keep the data even when space runs low. Firefox asks the person, so call
   * it after something they did, such as saving. Undefined when the browser can't be asked.
   */
  requestPersistence(): Promise<boolean | undefined>
  /** Usage, quota, and whether the data is persisted, leaving out whatever the browser won't say */
  storageState(): Promise<StorageState>
}

/** The answer, or undefined when there's none or asking fails */
async function attempt<T>(ask: () => Promise<T> | undefined): Promise<T | undefined> {
  try {
    return await ask()
  } catch {
    return undefined
  }
}

/** Pass navigator.storage, or a fake in tests. */
export function createStorageHelpers(storage: StorageManagerLike | undefined): StorageHelpers {
  return {
    async requestPersistence() {
      if (storage?.persist === undefined) return undefined
      try {
        // Asking again once persisted is pointless, and Firefox would prompt for nothing
        if ((await storage.persisted?.()) === true) return true
        return await storage.persist()
      } catch {
        return false
      }
    },

    async storageState() {
      const [estimate, persisted] = await Promise.all([
        attempt(() => storage?.estimate?.()),
        attempt(() => storage?.persisted?.()),
      ])
      return {
        ...(estimate?.usage === undefined ? {} : { usage: estimate.usage }),
        ...(estimate?.quota === undefined ? {} : { quota: estimate.quota }),
        ...(persisted === undefined ? {} : { persisted }),
      }
    },
  }
}

/** Whether an error means the browser has no more space for this site. */
export function isStorageFull(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if ('name' in error && error.name === 'QuotaExceededError') return true
  // Dexie wraps the browser's error, keeping the original as inner
  return 'inner' in error && isStorageFull(error.inner)
}
