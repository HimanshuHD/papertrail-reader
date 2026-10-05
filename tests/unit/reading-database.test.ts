import { afterEach, expect, it, vi } from 'vitest'
import { ReadingMetadataDatabase } from '../../src/services/reading-database'

afterEach(() => vi.unstubAllGlobals())

function setup() {
  const transaction = {
    error: null,
    objectStore: vi.fn(() => ({})),
    oncomplete: null as (() => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onabort: null as (() => void) | null,
  }
  const database = { transaction: vi.fn(() => transaction), close: vi.fn() }
  const request = {
    result: database,
    onsuccess: null as (() => void) | null,
    onblocked: null as (() => void) | null,
  }
  vi.stubGlobal('indexedDB', { open: vi.fn(() => request) })
  return {
    transaction,
    database,
    request,
    storage: new ReadingMetadataDatabase('test-annotations'),
  }
}
it('waits for commit after a result is staged and closes its connection', async () => {
  const { transaction, database, request, storage } = setup()
  const done = vi.fn()
  const pending = storage.transaction((_store, result) => result('saved')).then(done)
  request.onsuccess?.()
  await Promise.resolve()
  expect(done).not.toHaveBeenCalled()
  transaction.oncomplete?.()
  await pending
  expect(done).toHaveBeenCalledWith('saved')
  expect(database.close).toHaveBeenCalledOnce()
})
it('preserves a bubbled quota error even when transaction.error is not yet set', async () => {
  const { transaction, database, request, storage } = setup()
  const quota = new DOMException('full', 'QuotaExceededError')
  const pending = storage.transaction((_store, result) => result('uncommitted'))
  request.onsuccess?.()
  await Promise.resolve()
  const event = new Event('error')
  Object.defineProperty(event, 'target', { value: { error: quota } })
  transaction.onerror?.(event)
  await expect(pending).rejects.toBe(quota)
  expect(database.close).toHaveBeenCalledOnce()
})
it('rejects blocked opens and closes a late connection without running a transaction', async () => {
  const { database, request, storage } = setup()
  const run = vi.fn()
  const pending = storage.transaction(run)
  request.onblocked?.()
  await expect(pending).rejects.toThrow('blocked')
  request.onsuccess?.()
  expect(run).not.toHaveBeenCalled()
  expect(database.transaction).not.toHaveBeenCalled()
  expect(database.close).toHaveBeenCalledOnce()
})
