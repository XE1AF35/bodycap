// Storage helpers with fake storage managers: asking to keep data, usage and quota, and full disks.
import { describe, expect, it, vi } from 'vitest'
import { createStorageHelpers, isStorageFull, type StorageManagerLike } from '@/data/storage'

describe('requestPersistence', () => {
  it.each<[string, StorageManagerLike | undefined]>([
    ['there is no storage manager', undefined],
    ['the browser has no way to ask', { persisted: () => Promise.resolve(false) }],
  ])('gives no answer when %s', async (_name, storage) => {
    expect(await createStorageHelpers(storage).requestPersistence()).toBeUndefined()
  })

  it('does not ask again once the data is persisted', async () => {
    const persist = vi.fn(() => Promise.resolve(true))
    const storage = { persisted: () => Promise.resolve(true), persist }
    expect(await createStorageHelpers(storage).requestPersistence()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it.each([true, false])(
    'asks when not persisted yet, and passes on the answer: %s',
    async (answer) => {
      const persist = vi.fn(() => Promise.resolve(answer))
      const storage = { persisted: () => Promise.resolve(false), persist }
      expect(await createStorageHelpers(storage).requestPersistence()).toBe(answer)
      expect(persist).toHaveBeenCalledOnce()
    },
  )

  it('treats a failed request as not persisted', async () => {
    const storage = { persist: () => Promise.reject(new Error('Not allowed')) }
    expect(await createStorageHelpers(storage).requestPersistence()).toBe(false)
  })
})

describe('storageState', () => {
  it('reports usage, quota, and whether the data is persisted', async () => {
    const storage: StorageManagerLike = {
      estimate: () => Promise.resolve({ usage: 2_500_000, quota: 100_000_000 }),
      persisted: () => Promise.resolve(true),
    }
    expect(await createStorageHelpers(storage).storageState()).toEqual({
      usage: 2_500_000,
      quota: 100_000_000,
      persisted: true,
    })
  })

  it.each<[string, StorageManagerLike | undefined, object]>([
    ['there is no storage manager', undefined, {}],
    [
      'the estimate fails',
      {
        estimate: () => Promise.reject(new Error('Private window')),
        persisted: () => Promise.resolve(false),
      },
      { persisted: false },
    ],
    [
      'the estimate leaves out the quota',
      { estimate: () => Promise.resolve({ usage: 10 }) },
      { usage: 10 },
    ],
    [
      'persistence cannot be checked',
      {
        estimate: () => Promise.resolve({ usage: 10, quota: 100 }),
        persisted: () => Promise.reject(new Error('No')),
      },
      { usage: 10, quota: 100 },
    ],
  ])('leaves out what it cannot find out when %s', async (_name, storage, state) => {
    expect(await createStorageHelpers(storage).storageState()).toEqual(state)
  })
})

describe('isStorageFull', () => {
  const full = new DOMException('The quota has been exceeded.', 'QuotaExceededError')

  it.each<[string, unknown, boolean]>([
    ["the browser's quota error", full, true],
    ['a wrapped quota error, as Dexie gives', { name: 'AbortError', inner: full }, true],
    ['an error twice wrapped', { name: 'DatabaseClosedError', inner: { inner: full } }, true],
    ['any other error', new Error('Something else'), false],
    ['the name on its own', 'QuotaExceededError', false],
    ['nothing', undefined, false],
  ])('recognises %s: %s', (_name, error, isFull) => {
    expect(isStorageFull(error)).toBe(isFull)
  })
})
