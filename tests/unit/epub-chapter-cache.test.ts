import { expect, it, vi } from 'vitest'
import {
  ChapterCache,
  ChapterCacheBudgetError,
  type PreparedChapter,
} from '../../src/features/epub/chapter-cache'
const MiB = 1024 * 1024
function entry(index: number, bytes = 10 * MiB): PreparedChapter {
  return { markup: `Chapter ${index}`, warnings: [], bytes, dispose: vi.fn() }
}
it('rotates previous/current/next and keeps entries reusable inside the window', async () => {
  const built = new Map<number, PreparedChapter>()
  const build = vi.fn(async (index: number) => {
    const result = entry(index)
    built.set(index, result)
    return result
  })
  const cache = new ChapterCache(build, 5)
  cache.focus(1)
  await cache.prepare(1)
  cache.commit(1)
  await cache.warm()
  expect([0, 1, 2].every((index) => cache.ready(index))).toBe(true)
  cache.focus(2)
  await cache.prepare(2)
  cache.commit(2)
  await cache.warm()
  expect(built.get(0)!.dispose).toHaveBeenCalledOnce()
  expect([1, 2, 3].every((index) => cache.ready(index))).toBe(true)
  expect(build.mock.calls.filter(([index]) => index === 2)).toHaveLength(1)
  cache.dispose()
  for (const prepared of built.values()) expect(prepared.dispose).toHaveBeenCalledOnce()
})
it('skips speculative chapters that exceed the shared budget without evicting the active chapter', async () => {
  const cache = new ChapterCache(
    async (index, _signal, budget) => {
      if (budget < 10 * MiB) throw new ChapterCacheBudgetError('full')
      return entry(index)
    },
    3,
    25 * MiB,
  )
  cache.focus(1)
  await cache.prepare(1)
  cache.commit(1)
  await cache.warm()
  expect(cache.ready(1)).toBe(true)
  expect([0, 1, 2].filter((index) => cache.ready(index))).toHaveLength(2)
  cache.dispose()
})
it('cancels obsolete background work before preparing a new foreground destination', async () => {
  let started!: () => void
  const ready = new Promise<void>((resolve) => {
    started = resolve
  })
  const cache = new ChapterCache(async (index, signal) => {
    if (index === 1) {
      started()
      await new Promise<void>((_resolve, reject) =>
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('cancelled', 'AbortError')),
          { once: true },
        ),
      )
    }
    return entry(index)
  }, 5)
  cache.focus(0)
  await cache.prepare(0)
  cache.commit(0)
  const warming = cache.warm()
  await ready
  cache.focus(3)
  await cache.prepare(3)
  cache.commit(3)
  await warming
  expect(cache.ready(1)).toBe(false)
  expect(cache.ready(3)).toBe(true)
  expect(cache.ready(0)).toBe(false)
  cache.dispose()
})

it('disposes a late speculative result after the cache has closed', async () => {
  let started!: () => void, finish!: (value: PreparedChapter) => void
  const ready = new Promise<void>((resolve) => {
    started = resolve
  })
  const active = entry(0),
    late = entry(1)
  const cache = new ChapterCache(async (index) => {
    if (!index) return active
    started()
    return new Promise<PreparedChapter>((resolve) => {
      finish = resolve
    })
  }, 2)
  cache.focus(0)
  await cache.prepare(0)
  cache.commit(0)
  const warming = cache.warm()
  await ready
  cache.dispose()
  finish(late)
  await warming
  expect(active.dispose).toHaveBeenCalledOnce()
  expect(late.dispose).toHaveBeenCalledOnce()
  expect(cache.ready(1)).toBe(false)
})

it('pins the departing chapter until a distant replacement has committed', async () => {
  const old = entry(0),
    destination = entry(4)
  const cache = new ChapterCache(async (index) => (index ? destination : old), 5)
  cache.focus(0)
  await cache.prepare(0)
  cache.commit(0)
  cache.focus(4)
  await cache.prepare(4)
  expect(old.dispose).not.toHaveBeenCalled()
  cache.commit(4)
  expect(old.dispose).toHaveBeenCalledOnce()
  cache.dispose()
  expect(destination.dispose).toHaveBeenCalledOnce()
})
