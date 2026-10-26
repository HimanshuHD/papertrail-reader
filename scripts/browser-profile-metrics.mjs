// External profiler helpers. No imports from the production application.
import { readFile, readlink } from 'node:fs/promises'

export function rssBytesFromStatus(text) {
  const match = /^VmRSS:\s+(\d+) kB$/m.exec(text)
  return match ? Number(match[1]) * 1024 : null
}
export async function processRSS(pid, platform = process.platform, executable) {
  if (platform !== 'linux' || !Number.isSafeInteger(pid) || pid <= 0) return null
  try {
    if (!executable || (await readlink(`/proc/${pid}/exe`)) !== executable) return null
    return rssBytesFromStatus(await readFile(`/proc/${pid}/status`, 'utf8'))
  } catch {
    return null // Exited/inaccessible process; never report it as measured zero.
  }
}
export function processInterval(before, after, elapsedMs) {
  const previous = new Map(before.map((row) => [row.id, row]))
  const groups = {}
  for (const row of after) {
    const old = previous.get(row.id)
    const type = ['browser', 'renderer', 'GPU', 'utility'].includes(row.type) ? row.type : 'other'
    const group = (groups[type] ??= { matched: 0, unmatched: 0, cpuSeconds: 0 })
    if (!old || old.type !== row.type || row.cpuTime < old.cpuTime) {
      group.unmatched++
      continue
    }
    group.matched++
    group.cpuSeconds += row.cpuTime - old.cpuTime
    previous.delete(row.id)
  }
  return {
    elapsedMs,
    exitedOrUnmatchedBefore: previous.size,
    groups: Object.fromEntries(
      Object.entries(groups).map(([key, value]) => [
        key,
        {
          ...value,
          // 100% = one logical core; can exceed 100 across threads/processes.
          oneCorePercent: elapsedMs > 0 ? (value.cpuSeconds / (elapsedMs / 1000)) * 100 : null,
        },
      ]),
    ),
  }
}
export function statistics(values) {
  if (!values.length || values.some((v) => !Number.isFinite(v) || v < 0))
    throw new Error('Expected nonempty finite nonnegative observations')
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return {
    count: sorted.length,
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    worst: sorted.at(-1),
    p95: sorted.length >= 20 ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null,
  }
}
export function traceSummary(events) {
  const allowed = new Set([
    'RunTask',
    'FunctionCall',
    'EvaluateScript',
    'Layout',
    'UpdateLayoutTree',
    'Paint',
    'RasterTask',
    'CompositeLayers',
  ])
  const groups = {}
  for (const event of events) {
    if (
      event.ph !== 'X' ||
      !allowed.has(event.name) ||
      !Number.isFinite(event.dur) ||
      event.dur < 0
    )
      continue
    // Nested trace durations overlap: never sum categories into total CPU time.
    const group = (groups[event.name] ??= { count: 0, inclusiveMs: 0, worstMs: 0, over50ms: 0 })
    const ms = event.dur / 1000
    group.count++
    group.inclusiveMs += ms
    group.worstMs = Math.max(group.worstMs, ms)
    if (ms > 50) group.over50ms++
  }
  return groups
}
export function calibrationCandidates(rows) {
  // A review worksheet, never an automatic accepted-budget decision.
  const grouped = new Map()
  for (const row of rows) {
    if (
      ![
        'pdf.cold-open',
        'epub.cold-open',
        'pdf.render',
        'pdf.navigation',
        'epub.chapter',
        'epub.reflow',
        'library.scan',
        'library.first-listing',
      ].includes(row.profile)
    )
      continue
    if (!Number.isFinite(row.durationMs) || row.durationMs < 0)
      throw new Error('Invalid operation observation')
    const key = `${row.mode}/${row.profile}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(row.durationMs)
  }
  return [...grouped].map(([key, values]) => ({
    key,
    units: 'milliseconds',
    ...statistics(values),
    status: 'review-required',
    attentionMs: null,
    criticalMs: null,
    reason:
      'Observed distributions are not user-experience targets. Choose thresholds and scope after reviewing profiler overhead and representative workloads.',
  }))
}

/** Sampled process RAM remains separate from page heap and physical GPU memory. */
export function memorySummary(run) {
  const checkpoint = (cycle) =>
    run.samples[run.checkpoints.find((row) => row.cycle === cycle)?.sampleIndex]
  const point = (sample) => {
    if (!sample) return null
    const known = sample.processes.filter((row) => row.rssBytes !== null)
    return {
      residentSumBytes: known.length ? known.reduce((sum, row) => sum + row.rssBytes, 0) : null,
      measuredProcesses: known.length,
      reportedProcesses: sample.processes.length,
      completeRSSCoverage: known.length === sample.processes.length && known.length > 0,
      pageJSHeapBytes: sample.pageMetrics.JSHeapUsedSize ?? null,
      pageNodes: sample.pageMetrics.Nodes ?? null,
      pageListeners: sample.pageMetrics.JSEventListeners ?? null,
    }
  }
  const points = run.samples.map(point)
  return {
    baseline: point(checkpoint(0)),
    afterFive: point(checkpoint(5)),
    afterTen: point(checkpoint(10)),
    sampledPeakPageHeapBytes: Math.max(0, ...points.map((row) => row.pageJSHeapBytes ?? 0)) || null,
    // Only complete coverage samples are comparable for the process sum peak.
    sampledPeakCompleteRSSBytes: points.some((row) => row.completeRSSCoverage)
      ? Math.max(
          ...points.filter((row) => row.completeRSSCoverage).map((row) => row.residentSumBytes),
        )
      : null,
  }
}
export function reportMarkdown(report) {
  const mb = (value) => (value == null ? 'Unavailable' : (value / 1048576).toFixed(1))
  const rows = report.runs.map((run) => {
    const memory = memorySummary(run)
    const cpu = run.samples
      .flatMap((sample) => Object.values(sample.cpuInterval?.groups ?? {}))
      .reduce((sum, group) => sum + group.cpuSeconds, 0)
    return `| ${run.mode} | ${run.trial} | ${run.status} | ${run.traced ? 'trace' : 'metrics'}${run.heaps ? ' + GC heaps' : ''} | ${cpu.toFixed(2)} | ${mb(memory.baseline?.pageJSHeapBytes)} / ${mb(memory.afterFive?.pageJSHeapBytes)} / ${mb(memory.afterTen?.pageJSHeapBytes)} | ${mb(memory.sampledPeakCompleteRSSBytes)} |`
  })
  return [
    '# External profiling — private local report',
    '',
    `Source: ${report.source.sha}; tree: ${report.source.tree}; dirty: ${report.source.dirty}.`,
    '',
    `Status: ${report.status}. Accepted budgets: false. GPU utilization/VRAM: unavailable.`,
    '',
    '| Mode | Repeat | Result | Instrumentation | Matched process CPU seconds (lower bound) | Page JS heap MiB: baseline / 5 / 10 | Sampled complete-process RSS peak MiB |',
    '| --- | --- | --- | --- | ---: | --- | ---: |',
    ...rows,
    '',
    'RSS includes shared pages; incomplete process coverage is unavailable for the sum peak. Heap is the page target only. CPU is not GPU utilization. Nested trace categories overlap.',
    '',
    '## Calibration worksheet',
    '',
    '| Mode/profile | Count | Median ms | Worst ms | p95 ms |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...report.calibration.map(
      (row) =>
        `| ${row.key} | ${row.count} | ${row.median.toFixed(2)} | ${row.worst.toFixed(2)} | ${row.p95 == null ? 'Insufficient observations' : row.p95.toFixed(2)} |`,
    ),
    '',
    'These observations do not set accepted targets. Review the fixture/environment and profiler overhead, choose scoped thresholds, then validate them against independent runs. Unmeasured operation profiles remain unconfigured.',
    '',
    '## Limitations',
    '',
    ...report.limitations.map((text) => `- ${text}`),
    '',
  ].join('\n')
}
