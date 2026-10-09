// Helpers for UI tests: the whole app on an in-memory address bar and fake-indexeddb, and a
// connection status the test controls.
import { createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { vi } from 'vitest'
import type { ConnectionProblem, ConnectionStatus } from '@/data/connection'
import { BodycapDatabase } from '@/data/db'
import type { PixelSize } from '@/core/photos'
import { createRepositories } from '@/data/dexie-repositories'
import { createStorageHelpers } from '@/data/storage'
import { createAppRouter } from '@/router'
import { App } from '@/ui/App'
import { compressPhoto, type DecodePhoto, type Picture } from '@/ui/photos/compress'
import { createInstallOffer } from '@/ui/pwa/install-offer'
import { createUpdateOffer } from '@/ui/pwa/update-offer'
import type { Services } from '@/ui/services'

/** A connection status whose problems the test reports by hand */
export function fakeConnection(initial?: ConnectionProblem) {
  let problem = initial
  const listeners = new Set<() => void>()
  const status: ConnectionStatus = {
    current: () => problem,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return {
    status,
    report: (next: ConnectionProblem) => {
      problem = next
      for (const listener of listeners) listener()
    },
  }
}

/** A picture with no canvas behind it, which writes out whatever type is asked for */
function canvaslessPicture(size: PixelSize): Picture {
  return {
    ...size,
    scaled: (next) => canvaslessPicture(next),
    encode: (type) =>
      Promise.resolve(new Blob([`${type} ${String(size.width)}x${String(size.height)}`], { type })),
  }
}

/** Opens any photo as 4000 by 3000 pixels, since jsdom can't decode images */
const decodeWithoutCanvas: DecodePhoto = () =>
  Promise.resolve({ ...canvaslessPicture({ width: 4000, height: 3000 }), close: () => undefined })

/**
 * Services on a new, empty database, which a test can fill before rendering. Storage starts with
 * no storage manager, as in an insecure context, unless the test passes its own.
 */
export function testServices({
  connection = fakeConnection().status,
  storage = createStorageHelpers(undefined),
}: Partial<Pick<Services, 'connection' | 'storage'>> = {}): Services {
  const db = new BodycapDatabase({ indexedDB: new IDBFactory(), IDBKeyRange })
  return {
    repositories: createRepositories(db),
    connection,
    storage,
    updates: createUpdateOffer(),
    install: createInstallOffer(undefined),
    compressPhoto: (file) => compressPhoto(file, decodeWithoutCanvas),
  }
}

/** Renders the app at a path, as if typed into the address bar */
export function renderApp(path = '/', services: Services = testServices()) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  const view = render(<App router={router} services={services} />)
  return { ...view, router, services }
}

/** Catches the files the app saves, since jsdom can't download. Restore mocks after each test. */
export function stubDownloads() {
  const saved: { name: string; blob: Blob }[] = []
  let lastBlob: Blob | undefined
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    if (blob instanceof Blob) lastBlob = blob
    return 'blob:bodycap-test'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (lastBlob !== undefined) saved.push({ name: this.download, blob: lastBlob })
  })
  return saved
}

/**
 * Gives each Blob shown on screen an object URL of its own, since jsdom makes none. Restore mocks
 * after each test.
 */
export function stubObjectUrls() {
  let made = 0
  const revoked = new Set<string>()
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    made += 1
    return `blob:bodycap-photo-${String(made)}`
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    revoked.add(url)
  })
  return { revoked }
}
