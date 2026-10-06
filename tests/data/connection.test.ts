// Watching the database connection: storage that can't open, a newer Bodycap in another tab, and
// an old tab holding up an update.
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchConnection } from '@/data/connection'
import { BodycapDatabase } from '@/data/db'

const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

function track<T extends { close(): void }>(connection: T): T {
  cleanups.push(() => {
    connection.close()
  })
  return connection
}

// Some private windows refuse IndexedDB outright, which looks like this to the app
class RefusingFactory extends IDBFactory {
  override open(): IDBOpenDBRequest {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  }
}

describe('watchConnection', () => {
  it('reports nothing while the database is fine', async () => {
    const db = track(new BodycapDatabase({ indexedDB: new IDBFactory(), IDBKeyRange }))
    const status = watchConnection(db)
    await db.open()
    expect(status.current()).toBeUndefined()
  })

  it('reports storage that cannot open', async () => {
    const db = track(new BodycapDatabase({ indexedDB: new RefusingFactory(), IDBKeyRange }))
    const status = watchConnection(db)
    const listener = vi.fn()
    status.subscribe(listener)
    await vi.waitFor(() => {
      expect(status.current()).toBe('unavailable')
    })
    expect(listener).toHaveBeenCalledOnce()
  })

  it('reports a newer Bodycap opening in another tab', async () => {
    const indexedDB = new IDBFactory()
    const db = track(new BodycapDatabase({ indexedDB, IDBKeyRange }))
    const status = watchConnection(db)
    await db.open()

    const newer = track(new Dexie('bodycap', { indexedDB, IDBKeyRange }))
    newer.version(2).stores({ gear: 'id', settings: 'key' })
    await newer.open()
    expect(status.current()).toBe('updated-elsewhere')
  })

  it('reports an update held up by an old tab that will not close', async () => {
    const indexedDB = new IDBFactory()
    // A bare connection at an older version, with no handler to close it when asked
    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bodycap', 5)
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(request.error ?? new Error('Could not open'))
      }
    })
    track(old)

    const db = track(new BodycapDatabase({ indexedDB, IDBKeyRange }))
    const status = watchConnection(db)
    await vi.waitFor(() => {
      expect(status.current()).toBe('update-blocked')
    })
  })

  it('stops telling a listener once it unsubscribes', async () => {
    const db = track(new BodycapDatabase({ indexedDB: new RefusingFactory(), IDBKeyRange }))
    const status = watchConnection(db)
    const listener = vi.fn()
    status.subscribe(listener)()
    await vi.waitFor(() => {
      expect(status.current()).toBe('unavailable')
    })
    expect(listener).not.toHaveBeenCalled()
  })
})
