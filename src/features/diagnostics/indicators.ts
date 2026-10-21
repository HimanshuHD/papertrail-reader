import type { Metric } from './recorder'
import type { Snapshot } from './presentation'
import { metricNames } from './presentation'

export type IndicatorState =
  'recording' | 'attention' | 'critical' | 'inactive' | 'collecting' | 'unavailable' | 'stale'
export interface Target {
  attentionMs: number
  criticalMs: number
}
export interface IndicatorConfig {
  version: 1
  source: 'provisional local configuration; not accepted #16 budgets'
  windowMs: number
  minSamples: number
  sustainedSamples: number
  recoverySamples: number
  staleAfterMs: number
  frames: Target | null
  longTasks: Target | null
  operations: Partial<Record<Metric, Target>>
  pending: Partial<Record<Metric, Target>>
}
export function defaultIndicatorConfig(): IndicatorConfig {
  return {
    version: 1,
    source: 'provisional local configuration; not accepted #16 budgets',
    windowMs: 30000,
    minSamples: 3,
    sustainedSamples: 3,
    recoverySamples: 3,
    staleAfterMs: 5000,
    frames: { attentionMs: 50, criticalMs: 150 },
    longTasks: { attentionMs: 200, criticalMs: 1000 },
    operations: {},
    pending: {},
  }
}
export function validTarget(target: Target) {
  return (
    Number.isFinite(target.attentionMs) &&
    Number.isFinite(target.criticalMs) &&
    target.attentionMs > 0 &&
    target.criticalMs > target.attentionMs &&
    target.criticalMs <= 3600000
  )
}
export interface Finding {
  id: string
  state: 'attention' | 'critical'
  reason: string
  next: string
}
export interface IndicatorResult {
  state: IndicatorState
  label: string
  findings: Finding[]
  explanation: string
  supportedSamples: number
}
export interface IndicatorEvent {
  atMs: number
  state: IndicatorState
  findingIds: string[]
}
const validReading = (value: number | null) =>
  value !== null && Number.isFinite(value) && value >= 0
const labels: Record<IndicatorState, string> = {
  recording: 'Good · observed responsiveness',
  attention: 'Needs attention',
  critical: 'Critical',
  inactive: 'Evaluation paused',
  collecting: 'Collecting data',
  unavailable: 'Unavailable',
  stale: 'Stale readings',
}
/** Bounded, content-free interpretation of actual recorder observations. No browser-wide score. */
export class IndicatorMonitor {
  readonly config: IndicatorConfig
  readonly history: IndicatorEvent[] = []
  private epoch = 0
  private lastSample = -1
  private recovery = 0
  private held: Finding[] = []
  private signature = ''
  constructor(config = defaultIndicatorConfig()) {
    this.config = structuredClone(config)
  }
  restart(now: number, clearHistory = false) {
    this.epoch = now
    this.lastSample = -1
    this.recovery = 0
    this.held = []
    this.signature = ''
    if (clearHistory) this.history.length = 0
  }
  update(snapshot: Snapshot, now: number, foreground = true): IndicatorResult {
    const finish = (
      state: IndicatorState,
      findings: Finding[],
      explanation: string,
      supportedSamples = 0,
    ) => {
      const signature =
        state +
        findings
          .map((f) => f.id)
          .sort()
          .join('|')
      if (signature !== this.signature) {
        this.history.push({ atMs: now, state, findingIds: findings.map((f) => f.id) })
        if (this.history.length > 120) this.history.shift()
        this.signature = signature
      }
      return { state, label: labels[state], findings, explanation, supportedSamples }
    }
    if (!snapshot.running || !foreground) {
      this.epoch = now
      this.held = []
      this.recovery = 0
      this.lastSample = -1
      return finish(
        'inactive',
        [],
        foreground
          ? 'Sampling paused; retained readings are not current.'
          : 'Background tab: evaluation suspended and foreground window reset.',
      )
    }
    const start = Math.max(this.epoch, now - this.config.windowMs)
    const samples = snapshot.samples.filter(
      (s) => s.observedAtMs !== undefined && s.observedAtMs >= start && s.observedAtMs <= now,
    )
    const last = samples.at(-1)?.observedAtMs
    const newSample = last !== undefined && last !== this.lastSample
    if (newSample) this.lastSample = last
    const findings: Finding[] = []
    let supportedSamples = 0
    const evaluate = (
      id: string,
      name: string,
      values: number[],
      target: Target | null,
      next: string,
    ) => {
      if (!target || !validTarget(target)) return
      const recent = values.filter((v) => Number.isFinite(v) && v >= 0)
      supportedSamples = Math.max(supportedSamples, recent.length)
      const tail = recent.slice(-this.config.sustainedSamples)
      if (recent.length < this.config.minSamples || tail.length < this.config.sustainedSamples)
        return
      const critical = tail.every((v) => v >= target.criticalMs)
      if (!critical && !tail.every((v) => v >= target.attentionMs)) return
      const threshold = critical ? target.criticalMs : target.attentionMs
      findings.push({
        id,
        state: critical ? 'critical' : 'attention',
        reason: `${name}: ${tail.length} consecutive observations ≥ ${threshold} ms in the last ${this.config.windowMs / 1000}s; latest ${Math.round(tail.at(-1)!)} ms. Provisional target.`,
        next,
      })
    }
    // A missing measurement breaks a sustained series; unsupported data never counts as zero.
    const recent = samples.slice(-this.config.sustainedSamples)
    if (recent.every((s) => validReading(s.frameIntervalMs)))
      evaluate(
        'frames',
        'Foreground frame interval',
        samples.slice(-this.config.sustainedSamples).map((s) => s.frameIntervalMs!),
        this.config.frames,
        'Inspect main-thread scripting/layout/paint in a browser trace; this is not CPU or FPS.',
      )
    if (recent.every((s) => validReading(s.longTaskMs)))
      evaluate(
        'long-tasks',
        'Long-task duration per sample',
        samples.slice(-this.config.sustainedSamples).map((s) => s.longTaskMs!),
        this.config.longTasks,
        'Inspect repeated long tasks in a browser trace; avoid counting LoAF and Long Tasks twice.',
      )
    for (const metric of Object.keys(metricNames) as Metric[]) {
      const timings = snapshot.timings.filter(
        (t) =>
          t.metric === metric &&
          t.endedAtMs !== undefined &&
          t.endedAtMs >= start &&
          t.endedAtMs <= now &&
          t.startedAtMs !== undefined &&
          t.startedAtMs >= this.epoch,
      )
      evaluate(
        metric,
        metricNames[metric],
        timings.filter((t) => t.outcome === 'completed').map((t) => t.durationMs),
        this.config.operations[metric] ?? null,
        'Inspect this operation separately from cold opens, restore and warm activation; targets are local and provisional.',
      )
      const target = this.config.pending[metric]
      if (target && validTarget(target)) {
        const oldest = Math.max(
          0,
          ...snapshot.pendingDetails
            .filter((p) => p.metric === metric)
            .map((p) => now - Math.max(p.startedAtMs, this.epoch)),
        )
        if (oldest >= target.attentionMs)
          findings.push({
            id: `pending:${metric}`,
            state: oldest >= target.criticalMs ? 'critical' : 'attention',
            reason: `${metricNames[metric]} pending ${Math.round(oldest)} ms; provisional ${oldest >= target.criticalMs ? target.criticalMs : target.attentionMs} ms target.`,
            next: 'Inspect pending work/cancellation. A long operation is not automatically stuck; adjust the workload-specific target.',
          })
      }
    }
    const hasSupport = samples.some(
      (s) => validReading(s.frameIntervalMs) || validReading(s.longTaskMs),
    )
    if (!findings.length && (last === undefined || now - last > this.config.staleAfterMs)) {
      this.held = []
      this.recovery = 0
      return finish(
        now - this.epoch > this.config.staleAfterMs ? 'stale' : 'collecting',
        [],
        'Waiting for fresh foreground observations; no health pass is inferred.',
      )
    }
    if (!hasSupport && !findings.length) {
      this.held = []
      this.recovery = 0
      return finish(
        'unavailable',
        [],
        'Frame and long-task sources unavailable. Heap/resource totals do not substitute for responsiveness.',
      )
    }
    if (
      findings.length &&
      this.held.some((f) => f.state === 'critical') &&
      !findings.some((f) => f.state === 'critical')
    ) {
      if (newSample) this.recovery++
      if (this.recovery < this.config.recoverySamples)
        return finish(
          'critical',
          this.held,
          `Recovering to attention: ${this.recovery}/${this.config.recoverySamples} fresh evaluations.`,
          supportedSamples,
        )
    }
    if (findings.length) {
      this.held = findings
      this.recovery = 0
    } else if (this.held.length) {
      if (
        newSample &&
        recent.length >= this.config.sustainedSamples &&
        recent.every((s) => validReading(s.frameIntervalMs) || validReading(s.longTaskMs))
      )
        this.recovery++
      if (this.recovery >= this.config.recoverySamples) this.held = []
      else
        return finish(
          this.held.some((f) => f.state === 'critical') ? 'critical' : 'attention',
          this.held,
          `Recovering: ${this.recovery}/${this.config.recoverySamples} fresh supported evaluations without repeated breaches.`,
          supportedSamples,
        )
    }
    if (this.held.length)
      return finish(
        this.held.some((f) => f.state === 'critical') ? 'critical' : 'attention',
        this.held,
        'Repeated provisional signal; inspect the listed cause. No composite score is calculated.',
        supportedSamples,
      )
    const enough =
      recent.length >= this.config.minSamples &&
      ((this.config.frames !== null && recent.every((s) => validReading(s.frameIntervalMs))) ||
        (this.config.longTasks !== null && recent.every((s) => validReading(s.longTaskMs))))
    return finish(
      enough ? 'recording' : 'collecting',
      [],
      enough
        ? 'No repeated configured breach in observed responsiveness. Operation targets may be unconfigured; this is not a general performance certification.'
        : 'Insufficient supported samples; no health pass is inferred.',
      supportedSamples,
    )
  }
}
