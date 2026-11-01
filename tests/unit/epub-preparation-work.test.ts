import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EpubPreparationWork } from '../../src/features/epub/preparation-work'
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
it('keeps short work synchronous between checkpoints and yields accumulated work', async () => {
  const check = vi.fn(),
    work = new EpubPreparationWork(check)
  await work.checkpoint()
  expect(vi.getTimerCount()).toBe(0)
  vi.advanceTimersByTime(17)
  const pending = work.checkpoint()
  expect(vi.getTimerCount()).toBe(1)
  await vi.runAllTimersAsync()
  await pending
  expect(check).toHaveBeenCalledTimes(3)
  await work.checkpoint()
  expect(vi.getTimerCount()).toBe(0)
})
it('rejects cancellation delivered while yielding before any next-stage work', async () => {
  let aborted = false
  const error = new DOMException('Cancelled', 'AbortError')
  const work = new EpubPreparationWork(() => {
    if (aborted) throw error
  })
  const pending = expect(work.checkpoint(true)).rejects.toBe(error)
  aborted = true
  await vi.runAllTimersAsync()
  await pending
})
