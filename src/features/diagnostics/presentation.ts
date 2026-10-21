import type { DiagnosticRecorder, Metric, Timing } from './recorder'

export type Snapshot = ReturnType<DiagnosticRecorder['snapshot']>
export const P95_MIN_SAMPLES = 20
export const metricNames: Record<Metric, string> = {
  'library.scan': 'Library scan',
  'library.first-listing': 'First library listing',
  'pdf.open-readable': 'PDF open to readable',
  'pdf.render': 'PDF page render',
  'pdf.navigation': 'PDF page navigation',
  'epub.open-readable': 'EPUB open to readable',
  'epub.chapter': 'EPUB chapter navigation',
  'epub.reflow': 'EPUB layout reflow',
}
/** Statistics cover retained completed work only, not cancelled/failed durations. */
export function operationStats(timings: Timing[]) {
  return (Object.keys(metricNames) as Metric[]).map((metric) => {
    const matching = timings.filter((item) => item.metric === metric)
    const completed = matching.filter(
      (item) =>
        item.outcome === 'completed' && Number.isFinite(item.durationMs) && item.durationMs >= 0,
    )
    const sorted = completed.map((item) => item.durationMs).sort((a, b) => a - b)
    const count = sorted.length
    const middle = Math.floor(count / 2)
    return {
      metric,
      name: metricNames[metric],
      count,
      last: completed.at(-1)?.durationMs ?? null,
      median: count
        ? count % 2
          ? sorted[middle]!
          : (sorted[middle - 1]! + sorted[middle]!) / 2
        : null,
      p95: count >= P95_MIN_SAMPLES ? sorted[Math.ceil(count * 0.95) - 1]! : null,
      worst: sorted.at(-1) ?? null,
      cancelled: matching.filter((item) => item.outcome === 'cancelled').length,
      failed: matching.filter((item) => item.outcome === 'failed').length,
      unavailable: matching.filter((item) => item.outcome === 'unavailable').length,
    }
  })
}
export function measurement(value: number | null | undefined, unit = 'ms') {
  return value == null || !Number.isFinite(value) || value < 0
    ? 'Unavailable'
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`
}
/** Missing readings create gaps; a flat series is valid and never divided by zero. */
export function trendSegments(values: (number | null)[]) {
  const valid = values.filter(
    (value): value is number => value !== null && Number.isFinite(value) && value >= 0,
  )
  if (!valid.length) return []
  const min = Math.min(...valid)
  const span = Math.max(...valid) - min
  const segments: string[] = []
  let segment: string[] = []
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value) || value < 0) {
      if (segment.length) segments.push(segment.join(' '))
      segment = []
    } else {
      const x = values.length > 1 ? (index / (values.length - 1)) * 100 : 50
      const y = span ? 36 - ((value - min) / span) * 30 : 21
      segment.push(`${x.toFixed(2)},${y.toFixed(2)}`)
    }
  })
  if (segment.length) segments.push(segment.join(' '))
  return segments
}
