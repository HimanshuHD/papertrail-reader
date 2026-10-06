import { expect, it } from 'vitest'
import { ActiveReadingTime } from '../../src/features/reading/active-time'
import { ReadingMetadataDatabase } from '../../src/services/reading-database'
import { ReadingStatisticsStorage } from '../../src/services/reading-statistics'

it('pauses hidden/blurred/loading intervals, caps idle gaps and resumes only on activity', () => {
  const clock = new ActiveReadingTime(0)
  clock.setEligible(true, 0)
  expect(clock.tick(10_000)).toBe(10_000)
  clock.setEligible(false, 10_000)
  expect(clock.tick(40_000)).toBe(10_000)
  clock.setEligible(true, 40_000)
  expect(clock.tick(400_000)).toBe(70_000)
  expect(clock.isIdle(400_000)).toBe(true)
  clock.activity(400_000)
  expect(clock.tick(405_000)).toBe(75_000)
  expect(clock.tick(405_000)).toBe(75_000)
  expect(clock.tick(400_000)).toBe(75_000)
})
/** Atomic serialized seam with abort rollback; native acceptance remains release-gated. */
class Database extends ReadingMetadataDatabase {
  records = new Map<string, unknown>()
  failure = false
  queue = Promise.resolve()
  override transaction<T>(
    run: (store: IDBObjectStore, done: (value: T) => void) => void,
  ): Promise<T> {
    const task = this.queue.then(
      () =>
        new Promise<T>((resolve, reject) => {
          const staged = new Map(this.records)
          let aborted = false
          const abort = () => {
            aborted = true
            reject(new Error('Transaction aborted'))
          }
          const put = (v: { id: string }) => staged.set(v.id, structuredClone(v))
          const store = {
            transaction: { abort },
            put,
            add: put,
            get: (key: string) => {
              const r = {
                result: structuredClone(staged.get(key)),
                onsuccess: null as (() => void) | null,
              }
              queueMicrotask(() => {
                if (!aborted) r.onsuccess?.()
              })
              return r
            },
            openCursor: () => {
              const keys = Array.from(staged.keys())
              let index = 0
              const r = {
                result: null as null | { key: string; delete: () => void; continue: () => void },
                onsuccess: null as (() => void) | null,
              }
              const advance = () =>
                queueMicrotask(() => {
                  if (aborted) return
                  const key = keys[index++]
                  r.result = key
                    ? {
                        key,
                        delete: () => {
                          staged.delete(key)
                        },
                        continue: advance,
                      }
                    : null
                  r.onsuccess?.()
                })
              advance()
              return r
            },
          }
          run(store as unknown as IDBObjectStore, (result) =>
            queueMicrotask(() => {
              if (aborted) return
              if (this.failure) {
                this.failure = false
                reject(new Error('Quota'))
                return
              }
              this.records = staged
              resolve(result)
            }),
          )
        }),
    )
    this.queue = task.then(
      () => undefined,
      () => undefined,
    )
    return task
  }
}
const pdf = { format: 'PDF' as const, fingerprint: 'sha256-chunks-v1:' + 'a'.repeat(64) }
it('makes duplicate/older checkpoints idempotent across reloads and isolates documents/formats', async () => {
  const db = new Database(),
    storage = new ReadingStatisticsStorage(db)
  const first = await storage.open(pdf)
  await storage.checkpoint(first.handle, 10_000, 0.2)
  await storage.checkpoint(first.handle, 10_000, 0.2)
  expect((await storage.checkpoint(first.handle, 5_000, 1)).activeMs).toBe(10_000)
  const reopened = await storage.open(pdf)
  expect(reopened.summary).toMatchObject({ activeMs: 10_000, visits: 1, furthestPosition: 1 })
  expect(await storage.checkpoint(reopened.handle, 3_000, 0.1)).toMatchObject({
    activeMs: 13_000,
    visits: 2,
    lastPosition: 0.1,
    furthestPosition: 1,
  })
  expect((await storage.open({ ...pdf, format: 'EPUB' })).summary.activeMs).toBe(0)
  expect(
    (await storage.open({ ...pdf, fingerprint: 'sha256-chunks-v1:' + 'b'.repeat(64) })).summary
      .activeMs,
  ).toBe(0)
})
it('reset clears session metadata, rejects stale flushes and preserves other documents', async () => {
  const db = new Database(),
    storage = new ReadingStatisticsStorage(db)
  const first = await storage.open(pdf)
  const other = await storage.open({ ...pdf, format: 'EPUB' })
  await storage.checkpoint(first.handle, 12_000, 0.5)
  await storage.checkpoint(other.handle, 7_000, 0.3)
  const reset = await storage.reset(first.handle)
  expect(reset.summary).toMatchObject({ activeMs: 0, visits: 0, furthestPosition: 0 })
  await expect(storage.checkpoint(first.handle, 20_000, 1)).rejects.toThrow()
  expect((await storage.open(pdf)).summary.activeMs).toBe(0)
  expect((await storage.open({ ...pdf, format: 'EPUB' })).summary.activeMs).toBe(7_000)
  expect(Array.from(db.records.keys()).some((key) => key.includes(first.handle.sessionId))).toBe(
    false,
  )
})
it('rolls back failed persistence and reset; preserves unknown schemas rather than replacing them', async () => {
  const db = new Database(),
    storage = new ReadingStatisticsStorage(db)
  const { handle } = await storage.open(pdf)
  db.failure = true
  await expect(storage.checkpoint(handle, 10_000, 0.5)).rejects.toThrow('Quota')
  expect((await storage.open(pdf)).summary.activeMs).toBe(0)
  await storage.checkpoint(handle, 10_000, 0.5)
  db.failure = true
  await expect(storage.reset(handle)).rejects.toThrow('Quota')
  expect((await storage.open(pdf)).summary.activeMs).toBe(10_000)
  const unsupported = { ...(db.records.get(handle.id) as object), version: 2 }
  db.records.set(handle.id, unsupported)
  await expect(storage.open(pdf)).rejects.toThrow()
  expect(db.records.get(handle.id)).toEqual(unsupported)
})
