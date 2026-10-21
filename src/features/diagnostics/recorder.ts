declare global {
  const __READER_DIAGNOSTICS__: boolean
  const __DIAGNOSTIC_SOURCE__: { sha: string; dirty: boolean }
}
/** Fixed vocabulary only: never accept document identifiers or arbitrary diagnostic payloads. */
export type Metric =
  | 'library.scan'
  | 'library.first-listing'
  | 'pdf.open-readable'
  | 'pdf.render'
  | 'pdf.navigation'
  | 'epub.open-readable'
  | 'epub.chapter'
  | 'epub.reflow'
export type Outcome = 'completed' | 'cancelled' | 'failed' | 'unavailable'
export type Resources = Partial<
  Record<
    | 'viewers'
    | 'pdfWorkerOwners'
    | 'canvases'
    | 'previewEntries'
    | 'previewBytes'
    | 'dimensionEntries'
    | 'blobURLs',
    number
  >
>
export interface Timing {
  metric: Metric
  durationMs: number
  outcome: Outcome
}
export const LIMIT = 120
export class DiagnosticRecorder {
  readonly owners = new Map<object, Resources>()
  private cleanups = new Set<() => void>()
  private pending = new Map<object, Metric>()
  timings: Timing[] = []
  samples: {
    frameIntervalMs: number | null
    longTaskMs: number | null
    jsHeapBytes: number | null
  }[] = []
  running = false
  session = crypto.randomUUID()
  cancelled = 0
  dropped = 0
  start(metric: Metric): ((outcome?: Outcome) => void) | undefined {
    if (!this.running) return
    if (this.pending.size >= LIMIT) {
      this.dropped++
      return
    }
    const key = {}
    const start = performance.now()
    this.pending.set(key, metric)
    return (outcome = 'completed') => {
      if (!this.pending.delete(key)) return
      if (outcome === 'cancelled') this.cancelled++
      this.timings.push({ metric, durationMs: Math.max(0, performance.now() - start), outcome })
      if (this.timings.length > LIMIT) this.timings.shift()
    }
  }
  resources(owner: object, value: Resources) {
    this.owners.set(owner, value)
  }
  release(owner: object) {
    this.owners.delete(owner)
  }
  onStop(cleanup: () => void) {
    this.cleanups.add(cleanup)
    return () => this.cleanups.delete(cleanup)
  }
  private stopWork() {
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups.clear()
    this.pending.clear()
  }
  pause() {
    this.running = false
    this.stopWork()
  }
  resume() {
    this.running = true
  }
  reset() {
    this.stopWork()
    this.timings = []
    this.samples = []
    this.cancelled = 0
    this.dropped = 0
    this.session = crypto.randomUUID()
  }
  sample(value: DiagnosticRecorder['samples'][number]) {
    if (!this.running) return
    this.samples.push(value)
    if (this.samples.length > LIMIT) this.samples.shift()
  }
  snapshot() {
    const resources: Resources = {}
    for (const values of this.owners.values())
      for (const [key, value] of Object.entries(values)) {
        const name = key as keyof Resources
        resources[name] = (resources[name] ?? 0) + value
      }
    const pending = { index: 0, render: 0, other: 0 }
    for (const metric of this.pending.values()) {
      if (metric === 'library.scan') pending.index++
      else if (metric === 'pdf.render') pending.render++
      else pending.other++
    }
    return {
      schema: 1,
      session: this.session,
      running: this.running,
      resources,
      pending,
      cancellations: this.cancelled,
      droppedTimings: this.dropped,
      timings: this.timings.map((value) => ({ ...value })),
      samples: this.samples.map((value) => ({ ...value })),
    }
  }
}
export const diagnostics = /* @__PURE__ */ new DiagnosticRecorder()
export function diagnosticOutcome(error: unknown): Outcome {
  return error instanceof Error && /Abort|Cancel|replaced/i.test(error.name + error.message)
    ? 'cancelled'
    : 'failed'
}
