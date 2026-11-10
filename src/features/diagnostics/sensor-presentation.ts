import { P95_MIN_SAMPLES } from './presentation'
import type { SensorSnapshot } from './responsiveness'
export type SensorKind = 'inputs' | 'frames' | 'loading'
/** Statistics are over retained observations, never a time-window INP or calibrated health score. */
export function sensorStats(values: number[]) {
  const sorted = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b)
  const count = sorted.length
  const middle = Math.floor(count / 2)
  return {
    count,
    median: count
      ? count % 2
        ? sorted[middle]!
        : (sorted[middle - 1]! + sorted[middle]!) / 2
      : null,
    worst: sorted.at(-1) ?? null,
    p95: count >= P95_MIN_SAMPLES ? sorted[Math.ceil(count * 0.95) - 1]! : null,
  }
}
export function sensorView(snapshot: SensorSnapshot, kind: SensorKind) {
  // Interaction groups can be updated by a later event; order by observation time for truthful trends/latest.
  const rows = [
    ...(kind === 'inputs'
      ? snapshot.inputs
      : kind === 'frames'
        ? snapshot.frames
        : snapshot.resources),
  ].sort((a, b) => a.atMs - b.atMs)
  const values = rows.map((row) => row.durationMs)
  const latest = rows.at(-1)
  const input = kind === 'inputs' ? snapshot.inputs.find((row) => row === latest) : undefined
  const frame = kind === 'frames' ? snapshot.frames.find((row) => row === latest) : undefined
  return {
    values,
    latest: latest?.durationMs ?? null,
    stats: sensorStats(values),
    breakdown:
      kind === 'inputs'
        ? [
            { label: 'Waiting to run', value: input?.waitMs ?? null },
            { label: 'Handler processing', value: input?.handlerMs ?? null },
          ]
        : kind === 'frames'
          ? [
              { label: 'Blocking duration', value: frame?.blockingMs ?? null },
              { label: 'Rendering phase', value: frame?.renderingMs ?? null },
              { label: 'Style/layout phase', value: frame?.styleLayoutMs ?? null },
              { label: 'Forced layout', value: frame?.forcedLayoutMs ?? null },
            ]
          : [],
    resource:
      kind === 'loading'
        ? [...snapshot.resources].sort((a, b) => a.atMs - b.atMs).at(-1)
        : undefined,
  }
}
