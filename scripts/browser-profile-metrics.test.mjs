import test from 'node:test'
import assert from 'node:assert/strict'
import {
  rssBytesFromStatus,
  processRSS,
  processInterval,
  statistics,
  traceSummary,
  calibrationCandidates,
} from './browser-profile-metrics.mjs'

test('RSS is resident KiB, absent/inaccessible readings remain null', async () => {
  assert.equal(rssBytesFromStatus('VmSize: 999 kB\nVmRSS:    123 kB\n'), 125952)
  assert.equal(rssBytesFromStatus('VmSize: 999 kB'), null)
  assert.equal(await processRSS(1, 'win32'), null)
  assert.equal(await processRSS(-1), null)
})
test('CPU interval matches identities, reports churn and uses one-core units', () => {
  const result = processInterval(
    [
      { id: 1, type: 'renderer', cpuTime: 10 },
      { id: 2, type: 'GPU', cpuTime: 4 },
    ],
    [
      { id: 1, type: 'renderer', cpuTime: 12 },
      { id: 3, type: 'utility', cpuTime: 9 },
    ],
    1000,
  )
  assert.equal(result.groups.renderer.oneCorePercent, 200)
  assert.equal(result.groups.utility.unmatched, 1)
  assert.equal(result.exitedOrUnmatchedBefore, 1)
  assert.equal(
    processInterval([], [{ id: 1, type: 'GPU', cpuTime: 2 }], 0).groups.GPU.oneCorePercent,
    null,
  )
})
test('statistics preserve even median/worst, withhold sparse p95 and reject malformed data', () => {
  assert.deepEqual(statistics([8, 2, 4, 6]), { count: 4, median: 5, worst: 8, p95: null })
  assert.equal(statistics(Array.from({ length: 20 }, (_, i) => i + 1)).p95, 19)
  for (const values of [[], [NaN], [-1]]) assert.throws(() => statistics(values))
})
test('trace aggregation ignores document strings and unknown events, keeps inclusive categories separate', () => {
  const result = traceSummary([
    { ph: 'X', name: 'RunTask', dur: 60000, args: { url: 'secret' } },
    { ph: 'X', name: 'Layout', dur: 2000 },
    { ph: 'X', name: 'secret', dur: 1000 },
  ])
  assert.equal(result.RunTask.over50ms, 1)
  assert.equal(result.Layout.inclusiveMs, 2)
  assert.doesNotMatch(JSON.stringify(result), /secret|url/)
})
test('calibration keeps modes/profiles distinct and never invents accepted thresholds', () => {
  const rows = calibrationCandidates([
    { mode: 'sampling', profile: 'pdf.cold-open', durationMs: 10 },
    { mode: 'expanded', profile: 'pdf.cold-open', durationMs: 100 },
    { mode: 'sampling', profile: 'private-path', durationMs: 1 },
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].median, 10)
  assert.equal(rows[1].median, 100)
  assert.equal(rows[0].attentionMs, null)
  assert.equal(rows[0].status, 'review-required')
})

test('memory peak requires full process coverage and does not turn absent heap into zero', async () => {
  const { memorySummary } = await import('./browser-profile-metrics.mjs')
  const sample = { processes: [{ rssBytes: 10 }, { rssBytes: null }], pageMetrics: {} }
  const result = memorySummary({ samples: [sample], checkpoints: [{ cycle: 0, sampleIndex: 0 }] })
  assert.equal(result.baseline.residentSumBytes, 10)
  assert.equal(result.baseline.completeRSSCoverage, false)
  assert.equal(result.sampledPeakCompleteRSSBytes, null)
  assert.equal(result.sampledPeakPageHeapBytes, null)
  assert.equal(result.afterTen, null)
})

test('PID namespace parsing uses innermost ID and preserves unsupported status', async () => {
  const { namespacePIDFromStatus } = await import('./browser-profile-metrics.mjs')
  assert.equal(namespacePIDFromStatus('Name: chromium\nNSpid:\t4242\t23\n'), 23)
  assert.equal(namespacePIDFromStatus('NSpid:\t23\n'), 23)
  assert.equal(namespacePIDFromStatus('Pid:\t23\n'), null)
})
