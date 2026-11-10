import { expect, it } from 'vitest'
import { DiagnosticRecorder } from '../../src/features/diagnostics/recorder'
import {
  defaultIndicatorConfig,
  IndicatorMonitor,
  validTarget,
} from '../../src/features/diagnostics/indicators'
import type { Snapshot } from '../../src/features/diagnostics/presentation'
function snapshot(values: (number | null)[], start = 1000): Snapshot {
  const base = new DiagnosticRecorder().snapshot()
  return {
    ...base,
    running: true,
    samples: values.map((value, i) => ({
      observedAtMs: start + i * 1000,
      frameIntervalMs: value,
      longTaskMs: null,
      jsHeapBytes: null,
    })),
  }
}
it('keeps insufficient, unsupported, paused and stale measurements neutral', () => {
  const m = new IndicatorMonitor()
  expect(m.update(snapshot([16]), 1000).state).toBe('collecting')
  expect(m.update(snapshot([null, null, null]), 3000).state).toBe('unavailable')
  expect(m.update(snapshot([16, null, 16]), 3000).state).toBe('collecting')
  expect(m.update(snapshot([16, 16, 16]), 3000).state).toBe('recording')
  expect(m.update(snapshot([16, 16, 16]), 9000).state).toBe('stale')
  expect(m.update({ ...snapshot([200, 200, 200]), running: false }, 10000).state).toBe('inactive')
})
it('requires sustained breaches and fresh supported recovery; duplicate UI refreshes do not recover', () => {
  const m = new IndicatorMonitor()
  expect(m.update(snapshot([16, 16, 200]), 3000).state).toBe('recording')
  expect(m.update(snapshot([200, 200, 200]), 3000).state).toBe('critical')
  const healthy = snapshot([16, 16, 16], 4000)
  expect(m.update(healthy, 6000).state).toBe('critical')
  expect(m.update(healthy, 6000).explanation).toContain('1/3')
  expect(m.update(snapshot([16, 16, 16], 5000), 7000).state).toBe('critical')
  expect(m.update(snapshot([16, 16, 16], 6000), 8000).state).toBe('recording')
  expect(m.history.map((h) => h.state)).toEqual(['recording', 'critical', 'recording'])
})
it('excludes background work, cancellations and resource/heap totals from health findings', () => {
  const m = new IndicatorMonitor()
  expect(m.update(snapshot([200, 200, 200]), 3000, false).state).toBe('inactive')
  const s = snapshot([16, 16, 16], 4000)
  s.resources = { viewers: 100, previewBytes: 99999999 }
  s.timings = [
    {
      metric: 'pdf.render',
      outcome: 'cancelled',
      durationMs: 99999,
      startedAtMs: 4000,
      endedAtMs: 6000,
    },
  ]
  m.config.operations['pdf.render'] = { attentionMs: 10, criticalMs: 100 }
  expect(m.update(s, 6000).findings).toEqual([])
  m.restart(7000)
  expect(m.update(s, 7000).state).toBe('collecting')
})
it('uses only recent completed observations and configured per-operation targets', () => {
  const m = new IndicatorMonitor()
  const s = snapshot([16, 16, 16])
  s.timings = [1000, 2000, 3000].map((endedAtMs) => ({
    metric: 'epub.reflow',
    outcome: 'completed',
    durationMs: 70,
    startedAtMs: 500,
    endedAtMs,
  }))
  expect(m.update(s, 3000).state).toBe('recording')
  m.config.operations['epub.reflow'] = { attentionMs: 50, criticalMs: 200 }
  const result = m.update(s, 3000)
  expect(result.state).toBe('attention')
  expect(result.findings[0]?.reason).toContain('3 consecutive observations')
  expect(result.findings[0]?.next).toContain('cold opens')
  expect(m.update(snapshot([16, 16, 16], 40000), 42000).state).toBe('attention')
  expect(m.update(snapshot([16, 16, 16], 41000), 43000).state).toBe('attention')
  expect(m.update(snapshot([16, 16, 16], 42000), 44000).state).toBe('recording')
})
it('detects pending age only with a configured target and excludes background elapsed time', () => {
  const m = new IndicatorMonitor()
  const s = snapshot([16, 16, 16])
  s.pendingDetails = [{ metric: 'pdf.open-readable', startedAtMs: 1000 }]
  expect(m.update(s, 3000).findings).toEqual([])
  m.config.pending['pdf.open-readable'] = { attentionMs: 1000, criticalMs: 1500 }
  expect(m.update(s, 3000).findings[0]?.state).toBe('critical')
  m.update(s, 4000, false)
  expect(m.update(s, 4500).findings).toEqual([])
})
it('validates local targets and bounds transition history without document identifiers', () => {
  expect(validTarget({ attentionMs: 0, criticalMs: 1 })).toBe(false)
  expect(validTarget({ attentionMs: 10, criticalMs: NaN })).toBe(false)
  expect(validTarget({ attentionMs: 20, criticalMs: 10 })).toBe(false)
  expect(validTarget({ attentionMs: 10, criticalMs: 100 })).toBe(true)
  const m = new IndicatorMonitor(defaultIndicatorConfig())
  for (let i = 0; i < 150; i++) m.update({ ...snapshot([]), running: i % 2 === 0 }, i * 10000)
  expect(m.history.length).toBeLessThanOrEqual(120)
  expect(JSON.stringify(m.history)).not.toMatch(/document|path|title/)
})
it('holds critical during partial recovery before downgrading to attention', () => {
  const m = new IndicatorMonitor()
  expect(m.update(snapshot([200, 200, 200]), 3000).state).toBe('critical')
  const s = snapshot([60, 60, 60], 4000)
  expect(m.update(s, 6000).state).toBe('critical')
  expect(m.update(s, 6000).explanation).toContain('1/3')
  expect(m.update(snapshot([60, 60, 60], 5000), 7000).state).toBe('critical')
  expect(m.update(snapshot([60, 60, 60], 6000), 8000).state).toBe('attention')
})
it('retains warning evidence, worst value, rules and nearby work after recovery and pause', () => {
  const m = new IndicatorMonitor()
  const slow = snapshot([60, 60, 60])
  slow.timings = [
    {
      metric: 'pdf.render',
      outcome: 'completed',
      durationMs: 180,
      startedAtMs: 500,
      endedAtMs: 2900,
    },
  ]
  m.update(slow, 3000)
  m.update(snapshot([80, 80, 80], 2000), 4000)
  const warning = m.history[0]!
  expect(warning.findings[0]?.observedMs).toBe(80)
  expect(warning.context[0]?.metric).toBe('pdf.render')
  expect(warning.evaluations).toBe(2)
  m.update(snapshot([16, 16, 16], 5000), 7000)
  m.update(snapshot([16, 16, 16], 6000), 8000)
  m.update(snapshot([16, 16, 16], 7000), 9000)
  expect(warning.resolution).toBe('recovered')
  expect(warning.findings[0]?.reason).toContain('Foreground frame interval')
  m.config.frames!.attentionMs = 100
  expect(warning.configuration.frames?.attentionMs).toBe(50)
  m.restart(10000)
  expect(m.history).toContain(warning)
  m.restart(11000, true)
  expect(m.history).toEqual([])
})
