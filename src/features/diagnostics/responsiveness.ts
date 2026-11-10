/** Bounded, opt-in top-level observers. Never retain PerformanceEntry objects or attribution strings. */
const LIMIT = 120
const TYPES = ['event', 'long-animation-frame', 'resource'] as const
type Kind = (typeof TYPES)[number]
type Entry = PerformanceEntry & {
  processingStart?: number
  processingEnd?: number
  interactionId?: number
  blockingDuration?: number
  renderStart?: number
  styleAndLayoutStart?: number
  scripts?: { invokerType?: string; duration?: number; forcedStyleAndLayoutDuration?: number }[]
  initiatorType?: string
  transferSize?: number
  encodedBodySize?: number
}
export type InputReading = { atMs: number; waitMs: number; handlerMs: number; durationMs: number }
export type FrameReading = {
  atMs: number
  durationMs: number
  blockingMs: number | null
  renderingMs: number | null
  styleLayoutMs: number | null
  forcedLayoutMs: number | null
  scriptMs: Record<'event' | 'callback' | 'other', number | null>
}
export type ResourceReading = {
  atMs: number
  category: 'script' | 'css' | 'fetch' | 'xmlhttprequest' | 'other'
  durationMs: number
  transferBytes: number | null
  encodedBytes: number | null
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const value = (v: unknown) => (finite(v) ? v : null)
function retain<T>(rows: T[], row: T) {
  rows.push(row)
  if (rows.length > LIMIT) rows.shift()
}
export class ResponsivenessSensors {
  private observers: PerformanceObserver[] = []
  private generation = 0
  private since = 0
  private active = false
  private inputs = new Map<number, InputReading>()
  private frames: FrameReading[] = []
  private resources: ResourceReading[] = []
  private status: Record<Kind, string> = {
    event: 'Disabled: opt-in sensors',
    'long-animation-frame': 'Disabled: opt-in sensors',
    resource: 'Disabled: opt-in sensors',
  }
  private overhead = { callbacks: 0, entries: 0, dropped: 0, totalMs: 0, maxMs: 0 }
  private visibility = () => {
    this.since = performance.now()
    for (const observer of this.observers) observer.takeRecords()
  }
  start() {
    if (this.active) return
    this.active = true
    this.since = performance.now()
    const generation = ++this.generation
    document.addEventListener('visibilitychange', this.visibility)
    for (const kind of TYPES) {
      if (
        typeof PerformanceObserver === 'undefined' ||
        !PerformanceObserver.supportedEntryTypes?.includes(kind)
      ) {
        this.status[kind] = 'Unavailable: browser does not advertise this entry type'
        continue
      }
      let observer: PerformanceObserver | undefined
      try {
        observer = new PerformanceObserver((list) => {
          if (!this.active || generation !== this.generation || document.hidden) return
          const started = performance.now()
          const entries = list.getEntries()
          this.overhead.dropped += Math.max(0, entries.length - LIMIT)
          for (const entry of entries.slice(-LIMIT) as Entry[]) {
            if (entry.startTime < this.since || !finite(entry.startTime) || !finite(entry.duration))
              continue
            this.record(kind, entry)
            this.overhead.entries++
          }
          const elapsed = performance.now() - started
          this.overhead.callbacks++
          this.overhead.totalMs += elapsed
          this.overhead.maxMs = Math.max(this.overhead.maxMs, elapsed)
        })
        observer.observe({
          type: kind,
          buffered: false,
          ...(kind === 'event' ? { durationThreshold: 16 } : {}),
        })
        this.observers.push(observer)
        this.status[kind] = 'Observing: foreground entries since enable/resume; current frame only'
      } catch (error) {
        observer?.disconnect()
        // Error messages may contain resource paths. Export only a fixed failure category.
        this.status[kind] =
          error instanceof DOMException && error.name === 'SecurityError'
            ? 'Unavailable: browser security restriction'
            : 'Unavailable: observer initialization failed'
      }
    }
  }
  private record(kind: Kind, e: Entry) {
    if (kind === 'event') {
      if (
        !finite(e.interactionId) ||
        e.interactionId === 0 ||
        !finite(e.processingStart) ||
        !finite(e.processingEnd) ||
        e.processingStart < e.startTime ||
        e.processingEnd < e.processingStart
      )
        return
      const row = {
        atMs: e.startTime,
        waitMs: e.processingStart - e.startTime,
        handlerMs: e.processingEnd - e.processingStart,
        durationMs: e.duration,
      }
      const previous = this.inputs.get(e.interactionId)
      // Keep the longest eligible event per interaction; its breakdown remains internally consistent.
      if (!previous || row.durationMs > previous.durationMs) this.inputs.set(e.interactionId, row)
      if (this.inputs.size > LIMIT) this.inputs.delete(this.inputs.keys().next().value!)
    } else if (kind === 'long-animation-frame') {
      const end = e.startTime + e.duration
      const phase = (start: unknown) =>
        finite(start) && start > 0 && start >= e.startTime && start <= end ? end - start : null
      const scripts = e.scripts?.slice(0, LIMIT)
      const scriptMs: FrameReading['scriptMs'] = {
        event: scripts ? 0 : null,
        callback: scripts ? 0 : null,
        other: scripts ? 0 : null,
      }
      let forced = 0
      let hasForced = false
      for (const script of scripts ?? []) {
        const category =
          script.invokerType === 'event-listener'
            ? 'event'
            : script.invokerType === 'user-callback'
              ? 'callback'
              : 'other'
        scriptMs[category] = (scriptMs[category] ?? 0) + (value(script.duration) ?? 0)
        if (finite(script.forcedStyleAndLayoutDuration)) {
          forced += script.forcedStyleAndLayoutDuration
          hasForced = true
        }
      }
      retain(this.frames, {
        atMs: e.startTime,
        durationMs: e.duration,
        blockingMs: value(e.blockingDuration),
        renderingMs: phase(e.renderStart),
        styleLayoutMs: phase(e.styleAndLayoutStart),
        forcedLayoutMs: hasForced ? forced : null,
        scriptMs,
      })
    } else {
      const category = ['script', 'css', 'fetch', 'xmlhttprequest'].includes(e.initiatorType ?? '')
        ? (e.initiatorType as ResourceReading['category'])
        : 'other'
      retain(this.resources, {
        atMs: e.startTime,
        category,
        durationMs: e.duration,
        transferBytes: value(e.transferSize),
        encodedBytes: value(e.encodedBodySize),
      })
    }
  }
  stop() {
    this.active = false
    this.generation++
    this.observers.forEach((observer) => observer.disconnect())
    this.observers = []
    document.removeEventListener('visibilitychange', this.visibility)
  }
  reset() {
    this.stop()
    this.inputs.clear()
    this.frames = []
    this.resources = []
    this.overhead = { callbacks: 0, entries: 0, dropped: 0, totalMs: 0, maxMs: 0 }
    for (const kind of TYPES) this.status[kind] = 'Disabled: opt-in sensors'
  }
  snapshot() {
    return {
      active: this.active,
      capabilities: { ...this.status },
      scope: {
        secureContext: window.isSecureContext === true,
        frame: window.top === window.self ? 'top-level' : 'embedded frame',
        coverage:
          'Current frame only; iframe/worker activity is not fully covered. Browser security and timing restrictions apply.',
        eventTiming:
          'Eligible interactions only; requested threshold 16 ms, browser duration rounding (typically 8 ms). Not page INP; no continuous scroll/move timing.',
        longFrames:
          'Frames over 50 ms. Overlaps Long Tasks; never added to the health score. Script categories are partial, limited to 120 scripts per frame.',
        resources:
          'Network/resource entries since enable, not local-file read time. Zero transfer may mean cache, timing restrictions or another non-network source. Font/worker identity cannot be reliably inferred from initiator type; categorized as other.',
        retention:
          'Latest 120 interactions, frames and resources. At most 120 entries processed per callback; excess counted as dropped. No startup buffered entries.',
      },
      inputs: [...this.inputs.values()].map((row) => ({ ...row })),
      frames: this.frames.map((row) => ({ ...row, scriptMs: { ...row.scriptMs } })),
      resources: this.resources.map((row) => ({ ...row })),
      overhead: { ...this.overhead },
    }
  }
}
export type SensorSnapshot = ReturnType<ResponsivenessSensors['snapshot']>
