import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EpubLocationCapture } from '../../src/features/epub/location-capture'
let callbacks: FrameRequestCallback[]
beforeEach(() => {
  callbacks = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    callbacks.push(callback),
  )
  // Deliberately retain cancelled callbacks so stale-delivery guards are exercised.
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

it('coalesces a burst and reads the latest position rather than the first event', () => {
  let position = 0
  const capture = vi.fn(() => position)
  const scheduler = new EpubLocationCapture(capture)
  for (position = 0; position < 50; position++) scheduler.schedule()
  expect(callbacks).toHaveLength(1)
  expect(capture).not.toHaveBeenCalled()
  callbacks[0]!(0)
  expect(capture).toHaveReturnedWith(50)
  scheduler.flush()
  expect(capture).toHaveBeenCalledTimes(1)
})

it('flushes before persistence and prevents an old frame from overwriting the final anchor', () => {
  let position = 3
  const capture = vi.fn(() => position)
  const scheduler = new EpubLocationCapture(capture)
  scheduler.schedule()
  position = 9
  scheduler.flush()
  expect(capture).toHaveReturnedWith(9)
  position = 12
  callbacks[0]!(0)
  expect(capture).toHaveBeenCalledTimes(1)
})

it('invalidates work on chapter replacement/close and can schedule for a new chapter', () => {
  const capture = vi.fn()
  const scheduler = new EpubLocationCapture(capture)
  scheduler.schedule()
  scheduler.cancel()
  scheduler.cancel()
  callbacks[0]!(0)
  expect(capture).not.toHaveBeenCalled()
  scheduler.schedule()
  callbacks[1]!(0)
  expect(capture).toHaveBeenCalledTimes(1)
})
