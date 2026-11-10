/** Fixed-vocabulary, bounded investigation evidence. Never accepts keys, document IDs or arbitrary errors. */
export type ResourceOperation =
  | 'pdf.render-request'
  | 'pdf.release'
  | 'pdf.reader-release'
  | 'epub.reader-release'
  | 'reader.release'
  | 'reading.transaction'
  | 'workspace.transaction'
  | `reading.${'read' | 'write' | 'restore'}`
  | `workspace.${'restore' | 'write' | 'clear'}`
  | `${'pdf' | 'epub'}.${'cold-open' | 'warm-activate' | 'expired-open' | 'restored-open'}`
export type ResourceFailure = 'quota' | 'security' | 'cancelled' | 'blocked' | 'other'
export type CacheKind = 'preview' | 'dimensions'
export type ResourceOutcome = 'completed' | 'cancelled' | 'failed' | 'unavailable'
export const OWNED_KEYS = [
  'viewers',
  'pdfWorkerOwners',
  'canvases',
  'previewEntries',
  'previewBytes',
  'dimensionEntries',
  'blobURLs',
  'blobBytes',
  'canvasBytes',
  'ownedListeners',
  'ownedObservers',
  'ownedTimers',
] as const
export type OwnedKey = (typeof OWNED_KEYS)[number]
type Counts = Partial<Record<OwnedKey, number>>
type StorageReading = {
  usageBytes: number | null
  quotaBytes: number | null
  observedAtMs: number | null
  status: string
}
const LIMIT = 120
const numeric = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
const counts = (resources: Counts) =>
  Object.fromEntries(OWNED_KEYS.map((key) => [key, numeric(resources[key]) ?? 0])) as Record<
    OwnedKey,
    number
  >
export class ResourceInvestigation {
  private active = false
  private epoch = 0
  private storageRequest = 0
  private pending = new Map<
    object,
    { operation: ResourceOperation; queuedAtMs: number; startedAtMs: number | null }
  >()
  private timings: {
    operation: ResourceOperation
    queuedAtMs: number
    endedAtMs: number
    waitMs: number | null
    processingMs: number | null
    durationMs: number
    outcome: ResourceOutcome
    failure: ResourceFailure | null
  }[] = []
  private caches: Record<CacheKind, { hits: number; misses: number; evictions: number }> = {
    preview: { hits: 0, misses: 0, evictions: 0 },
    dimensions: { hits: 0, misses: 0, evictions: 0 },
  }
  private baseline: {
    atMs: number
    resources: Record<OwnedKey, number>
    heapBytes: number | null
  } | null = null
  private storage: StorageReading = {
    usageBytes: null,
    quotaBytes: null,
    observedAtMs: null,
    status: 'Not sampled: use Refresh storage estimate',
  }
  private pageMemory = {
    bytes: null as number | null,
    observedAtMs: null as number | null,
    durationMs: null as number | null,
    status: 'Not sampled: manual page memory only',
  }
  private memoryRequest = 0
  private memoryInFlight = false
  private dropped = 0
  resume() {
    this.active = true
  }
  pause() {
    this.active = false
    this.epoch++
    this.pending.clear()
    this.storageRequest++
    this.memoryRequest++
    if (this.pageMemory.status === 'Sampling')
      this.pageMemory = {
        bytes: null,
        observedAtMs: null,
        durationMs: null,
        status: 'Interrupted: sampling stopped',
      }
    if (this.storage.status === 'Sampling') this.storage.status = 'Interrupted: sampling stopped'
  }
  reset() {
    const active = this.active
    this.pause()
    this.active = active
    this.timings = []
    this.caches = {
      preview: { hits: 0, misses: 0, evictions: 0 },
      dimensions: { hits: 0, misses: 0, evictions: 0 },
    }
    this.baseline = null
    this.storage = {
      usageBytes: null,
      quotaBytes: null,
      observedAtMs: null,
      status: 'Not sampled: use Refresh storage estimate',
    }
    this.pageMemory = {
      bytes: null,
      observedAtMs: null,
      durationMs: null,
      status: 'Not sampled: manual page memory only',
    }
    this.dropped = 0
  }
  cache(kind: CacheKind, event: 'hits' | 'misses' | 'evictions') {
    if (this.active) this.caches[kind][event]++
  }
  begin(operation: ResourceOperation) {
    if (!this.active) return
    if (this.pending.size >= LIMIT) {
      this.dropped++
      return
    }
    const key = {}
    const epoch = this.epoch
    const entry = { operation, queuedAtMs: performance.now(), startedAtMs: null as number | null }
    this.pending.set(key, entry)
    return {
      start: () => {
        if (epoch === this.epoch && this.pending.has(key) && entry.startedAtMs === null)
          entry.startedAtMs = performance.now()
      },
      finish: (outcome: ResourceOutcome = 'completed', failure: ResourceFailure | null = null) => {
        if (epoch !== this.epoch || !this.pending.delete(key)) return
        const endedAtMs = performance.now()
        this.timings.push({
          operation,
          queuedAtMs: entry.queuedAtMs,
          endedAtMs,
          waitMs:
            entry.startedAtMs === null ? null : Math.max(0, entry.startedAtMs - entry.queuedAtMs),
          processingMs:
            entry.startedAtMs === null ? null : Math.max(0, endedAtMs - entry.startedAtMs),
          durationMs: Math.max(0, endedAtMs - entry.queuedAtMs),
          outcome,
          failure,
        })
        if (this.timings.length > LIMIT) this.timings.shift()
      },
    }
  }
  async track<T>(operation: ResourceOperation, run: (start: () => void) => Promise<T>): Promise<T> {
    const ticket = this.begin(operation)
    try {
      const result = await run(() => ticket?.start())
      ticket?.finish()
      return result
    } catch (error) {
      const failure: ResourceFailure =
        error instanceof Error || error instanceof DOMException
          ? error.name === 'QuotaExceededError'
            ? 'quota'
            : error.name === 'SecurityError'
              ? 'security'
              : /Abort|Cancel/i.test(error.name)
                ? 'cancelled'
                : /blocked/i.test(error.message)
                  ? 'blocked'
                  : 'other'
          : 'other'
      ticket?.finish(failure === 'cancelled' ? 'cancelled' : 'failed', failure)
      throw error
    }
  }
  markBaseline(resources: Counts, heapBytes: number | null) {
    this.baseline = {
      atMs: performance.now(),
      resources: counts(resources),
      heapBytes: numeric(heapBytes),
    }
  }
  clearBaseline() {
    this.baseline = null
  }
  async refreshStorage() {
    if (!this.active) return
    const request = ++this.storageRequest
    const epoch = this.epoch
    const apply = (reading: StorageReading) => {
      if (this.active && epoch === this.epoch && request === this.storageRequest)
        this.storage = reading
    }
    const unavailable = (status: string) =>
      apply({ usageBytes: null, quotaBytes: null, observedAtMs: null, status })
    try {
      if (globalThis.isSecureContext === false) {
        unavailable('Unavailable: secure context required')
        return
      }
      if (typeof navigator.storage?.estimate !== 'function') {
        unavailable('Unavailable: storage estimate unsupported')
        return
      }
      this.storage = { usageBytes: null, quotaBytes: null, observedAtMs: null, status: 'Sampling' }
      const result = await navigator.storage.estimate()
      apply({
        usageBytes: numeric(result.usage),
        quotaBytes: numeric(result.quota),
        observedAtMs: performance.now(),
        status: 'Origin storage estimate; disk usage, not RAM or per-document allocation',
      })
    } catch (error) {
      unavailable(
        error instanceof DOMException && error.name === 'SecurityError'
          ? 'Unavailable: browser security restriction'
          : 'Unavailable: storage estimate failed',
      )
    }
  }
  async refreshPageMemory() {
    if (!this.active || this.memoryInFlight) return
    const epoch = this.epoch,
      request = ++this.memoryRequest
    const apply = (
      status: string,
      bytes: number | null = null,
      durationMs: number | null = null,
    ) => {
      if (this.active && epoch === this.epoch && request === this.memoryRequest)
        this.pageMemory = {
          status,
          bytes,
          durationMs,
          observedAtMs: bytes === null ? null : performance.now(),
        }
    }
    try {
      const reason = pageMemoryUnavailable()
      if (reason) {
        apply(reason)
        return
      }
      this.pageMemory = { status: 'Sampling', bytes: null, durationMs: null, observedAtMs: null }
      this.memoryInFlight = true
      const start = performance.now()
      const measure = (
        performance as Performance & {
          measureUserAgentSpecificMemory(): Promise<{ bytes: unknown }>
        }
      ).measureUserAgentSpecificMemory
      const result = await measure.call(performance)
      const bytes = numeric(result.bytes)
      apply(
        bytes === null
          ? 'Unavailable: invalid page memory result'
          : 'Browser page memory estimate; attribution discarded',
        bytes,
        Math.max(0, performance.now() - start),
      )
    } catch {
      apply('Unavailable: page memory measurement failed or restricted')
    } finally {
      this.memoryInFlight = false
    }
  }
  snapshot(resources: Counts, heapBytes: number | null) {
    const owned = counts(resources)
    const heap = numeric(heapBytes)
    const now = performance.now()
    return {
      active: this.active,
      baseline: this.baseline
        ? {
            atMs: this.baseline.atMs,
            resources: { ...this.baseline.resources },
            heapBytes: this.baseline.heapBytes,
          }
        : null,
      comparison: OWNED_KEYS.map((key) => ({
        key,
        current: owned[key],
        baseline: this.baseline?.resources[key] ?? null,
        delta: this.baseline ? owned[key] - this.baseline.resources[key] : null,
        registration: resources[key] === undefined ? 'No registered owner' : 'Registered owner',
      })),
      heap: {
        currentBytes: heap,
        baselineBytes: this.baseline?.heapBytes ?? null,
        deltaBytes:
          this.baseline?.heapBytes != null && heap !== null ? heap - this.baseline.heapBytes : null,
      },
      observations: [
        ...(
          [
            'viewers',
            'pdfWorkerOwners',
            'canvases',
            'blobURLs',
            'ownedListeners',
            'ownedObservers',
            'ownedTimers',
          ] as const
        ).flatMap((key) => {
          const baseline = this.baseline?.resources[key]
          return baseline !== undefined && owned[key] !== baseline
            ? [{ key: key as OwnedKey | 'jsHeapBytes', delta: owned[key] - baseline }]
            : []
        }),
        ...(this.baseline?.heapBytes != null && heap !== null && heap !== this.baseline.heapBytes
          ? [{ key: 'jsHeapBytes' as const, delta: heap - this.baseline.heapBytes }]
          : []),
      ],
      caches: { preview: { ...this.caches.preview }, dimensions: { ...this.caches.dimensions } },
      timings: this.timings.map((row) => ({ ...row })),
      pending: [...this.pending.values()].map((row) => ({
        operation: row.operation,
        queuedAtMs: row.queuedAtMs,
        phase: row.startedAtMs === null ? 'waiting' : 'processing',
        ageMs: Math.max(0, now - row.queuedAtMs),
      })),
      dropped: this.dropped,
      storage: { ...this.storage },
      pageMemory: { ...this.pageMemory, pending: this.memoryInFlight },
      scope: {
        owned:
          'Instrumented application owners only; zero means no tracked ownership, never browser-wide zero. Canvas RGBA is a pixel estimate; Blob bytes are logical payload size. Do not sum these with heap/process memory.',
        timings:
          'PDF wait covers previous-render cancellation/preparation; processing includes asynchronous PDF.js/render response. IndexedDB wait covers opening the connection; processing ends with transaction completion. Reading restore resolves saved identity/settings and may create or migrate metadata; read/write labels describe logical intent, not IDB transaction mode. Reader open runs from instance creation to its ready/error signal (including restoration); warm activation measures synchronous selection dispatch, not paint or first-readable latency. Not worker CPU or engine-internal queue/response phases.',
        caches:
          'Session-window hits/misses and capacity evictions at instrumented PDF preview/dimension lookups; no cache keys, files or document identities.',
        cleanup:
          'Mark before open/switch/close, then compare after disposal settles. Expected inactive readers can remain for five minutes. Reader release timings run from release scheduling through the runtime disposal promise (including persistence settling), not proof of garbage collection. Positive deltas are investigation hints, not leak proof.',
        untracked:
          'Explicit PDF/EPUB shell, EPUB frame bindings, PDF selection guard and retention/loader timer registrations only; Vue/engine/internal/helper registrations and browser paint after warm selection remain untracked. Generic transactions from other metadata services remain unattributed.',
        pageMemory:
          pageMemoryUnavailable() ??
          'Optional page memory available for manual sampling; browser estimate, not process/GPU memory. Attribution URLs/IDs are discarded. No hosting changes.',
      },
    }
  }
}
export type InvestigationSnapshot = ReturnType<ResourceInvestigation['snapshot']>

function pageMemoryUnavailable(): string | null {
  try {
    if (globalThis.isSecureContext !== true)
      return 'Unavailable: secure context required for page memory'
    if (globalThis.crossOriginIsolated !== true)
      return 'Unavailable: cross-origin isolation required for page memory; no hosting changes'
    return typeof (performance as Performance & { measureUserAgentSpecificMemory?: unknown })
      .measureUserAgentSpecificMemory === 'function'
      ? null
      : 'Unavailable: optional page memory API unsupported; no hosting changes'
  } catch {
    return 'Unavailable: optional page memory access restricted'
  }
}
