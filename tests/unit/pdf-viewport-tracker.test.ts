import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PdfViewportTracker } from '../../src/features/pdf/viewport-tracker'

let frames: Map<number, FrameRequestCallback>
let nextFrame: number
const observers: {
  callback: IntersectionObserverCallback
  observe: ReturnType<typeof vi.fn>
  unobserve: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}[] = []
function flushFrame() {
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(0))
}
beforeEach(() => {
  frames = new Map()
  nextFrame = 0
  observers.length = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      constructor(callback: IntersectionObserverCallback) {
        observers.push({
          callback,
          observe: this.observe,
          unobserve: this.unobserve,
          disconnect: this.disconnect,
        })
      }
    },
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function pane() {
  const root = document.createElement('section')
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 600))
  return root
}
it('shares two observers and one frame, finds a distant jump without scanning all 1,001 pages', () => {
  const updated = vi.fn()
  const tracker = new PdfViewportTracker(updated)
  const root = pane()
  tracker.setRoot(root)
  const pages = Array.from({ length: 1001 }, (_, index) => {
    const element = document.createElement('article')
    const measured = vi
      .spyOn(element, 'getBoundingClientRect')
      .mockImplementation(() => new DOMRect(0, index * 624 - root.scrollTop, 800, 600))
    const proximity = vi.fn()
    tracker.register(element, index + 1, proximity)
    return { element, measured, proximity }
  })
  expect(observers).toHaveLength(2)
  expect(observers.every((observer) => observer.observe.mock.calls.length === 1001)).toBe(true)
  expect(frames.size).toBe(1)
  flushFrame()
  expect(updated).toHaveBeenCalledTimes(1)
  pages.forEach(({ measured, proximity }) => {
    measured.mockClear()
    proximity.mockClear()
  })
  root.scrollTop = 800 * 624
  for (let index = 0; index < 50; index++) tracker.schedule()
  expect(frames.size).toBe(1)
  flushFrame()
  const sample = updated.mock.lastCall![0]
  expect(sample.pages.map((page: { page: number }) => page.page)).toContain(801)
  expect(pages.reduce((sum, page) => sum + page.measured.mock.calls.length, 0)).toBeLessThan(30)
  expect(pages.filter((page) => page.proximity.mock.calls.length)).toHaveLength(8)
  expect(pages[400]!.proximity).not.toHaveBeenCalled()
  expect(pages[0]!.proximity).toHaveBeenCalledWith(false)
  expect(pages[800]!.proximity).toHaveBeenCalledWith(true)
  tracker.dispose()
  expect(observers.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true)
})

it('uses full grid rows for unequal-height spreads and remeasures changed layout without observers', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const tracker = new PdfViewportTracker()
  const root = pane()
  tracker.setRoot(root)
  tracker.setColumns(2)
  let offset = 1100
  const geometry = [
    [0, 100],
    [0, 2000],
    [2024, 600],
    [2024, 900],
  ]
  const callbacks = geometry.map(([top, height], index) => {
    const element = document.createElement('article')
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, top! - offset, 400, height),
    )
    const callback = vi.fn()
    tracker.register(element, index + 1, callback)
    return callback
  })
  expect(tracker.measure()!.pages.map((page) => page.page)).toEqual([2, 3, 4])
  offset = 2800
  expect(tracker.measure()!.pages.map((page) => page.page)).toEqual([3, 4])
  expect(callbacks[1]).toHaveBeenLastCalledWith(false)
  tracker.dispose()
})

it('rejects stale observer deliveries after root replacement/disposal and unobserves removed pages', () => {
  const tracker = new PdfViewportTracker()
  const root = pane()
  tracker.setRoot(root)
  const element = document.createElement('article')
  const remove = tracker.register(element, 1, vi.fn())
  flushFrame()
  const old = observers[0]!
  tracker.setRoot(pane())
  flushFrame()
  old.callback([], {} as IntersectionObserver)
  expect(frames.size).toBe(0)
  remove()
  remove()
  expect(observers[2]!.unobserve).toHaveBeenCalledOnce()
  const latest = observers[2]!
  tracker.dispose()
  tracker.dispose()
  latest.callback([], {} as IntersectionObserver)
  tracker.schedule()
  expect(frames.size).toBe(0)
  expect(tracker.measure()).toBeNull()
})
