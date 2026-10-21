import { diagnostics } from './recorder'

export function capabilities() {
  return {
    frames:
      typeof requestAnimationFrame === 'function'
        ? 'requestAnimationFrame interval estimate (foreground only)'
        : 'Unavailable: requestAnimationFrame absent',
    longTasks:
      typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes?.includes('longtask')
        ? 'PerformanceObserver longtask duration, ms'
        : 'Unavailable: longtask observer unsupported',
    memory:
      heapBytes() === null
        ? 'Unavailable: nonstandard performance.memory unsupported'
        : 'performance.memory.usedJSHeapSize, bytes; JS heap only, not process/GPU/canvas memory',
    workers:
      'Tracked PDF loading-task worker owners; shared/fake worker implementation is not a thread count',
  }
}
export function heapBytes(): number | null {
  try {
    const value = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory
      ?.usedJSHeapSize
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
  } catch {
    return null
  }
}
/** One sampler per open panel. No document/DOM content is observed. */
export function startSampler(onUpdate: () => void) {
  let frame = 0
  let previous = 0
  let frameTotal = 0
  let frameCount = 0
  let longTaskMs: number | null = null
  let observer: PerformanceObserver | undefined
  let stopped = false
  const available = capabilities()
  const overhead = { samples: 0, totalMs: 0, maxMs: 0 }
  try {
    if (
      typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes?.includes('longtask')
    ) {
      observer = new PerformanceObserver((list) => {
        longTaskMs =
          (longTaskMs ?? 0) + list.getEntries().reduce((sum, entry) => sum + entry.duration, 0)
      })
      observer.observe({ type: 'longtask', buffered: false })
      longTaskMs = 0
    }
  } catch {
    observer?.disconnect()
    observer = undefined
    available.longTasks = 'Unavailable: longtask observer initialization failed'
  }
  function visibilityChanged() {
    previous = 0
    frameTotal = 0
    frameCount = 0
  }
  document.addEventListener('visibilitychange', visibilityChanged)
  function tick(now: number) {
    if (stopped) return
    if (!document.hidden && previous) {
      frameTotal += now - previous
      frameCount++
    }
    previous = document.hidden ? 0 : now
    frame = requestAnimationFrame(tick)
  }
  if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(tick)
  const timer = setInterval(() => {
    const start = performance.now()
    diagnostics.sample({
      frameIntervalMs: frameCount ? frameTotal / frameCount : null,
      longTaskMs,
      jsHeapBytes: heapBytes(),
    })
    frameTotal = 0
    frameCount = 0
    if (longTaskMs !== null) longTaskMs = 0
    onUpdate()
    const duration = performance.now() - start
    overhead.samples++
    overhead.totalMs += duration
    overhead.maxMs = Math.max(overhead.maxMs, duration)
  }, 1000)
  return {
    overhead,
    available,
    stop() {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visibilityChanged)
      if (frame) cancelAnimationFrame(frame)
      observer?.disconnect()
    },
  }
}
