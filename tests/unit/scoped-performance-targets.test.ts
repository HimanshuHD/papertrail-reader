import { expect, it } from 'vitest'
import { defaultIndicatorConfig, IndicatorMonitor } from '../../src/features/diagnostics/indicators'
import { DiagnosticRecorder } from '../../src/features/diagnostics/recorder'
import {
  fixtureBrowser,
  fixtureTargetConfiguration,
  fixtureTargets,
} from '../fixtures/scoped-performance-targets'

const scope = { ...fixtureBrowser, fixture: 'directory-1000' }

it('requires the full fixture and browser scope before configuring one operation', () => {
  const config = fixtureTargetConfiguration(scope)
  expect(config?.operations).toEqual({
    'library.scan': { attentionMs: 475, criticalMs: 950 },
  })
  expect(fixtureTargetConfiguration({ ...scope, fixture: 'constructor' })).toBeNull()
  expect(fixtureTargetConfiguration({ ...scope, engine: 'firefox' })).toBeNull()
  expect(fixtureTargetConfiguration({ ...scope, version: '156.0.0.0' })).toBeNull()
  expect(fixtureTargetConfiguration({ ...scope, graphics: 'hardware' })).toBeNull()
  expect(fixtureTargetConfiguration({ ...scope, width: 1024 })).toBeNull()
  expect(fixtureTargetConfiguration({ ...scope, sensors: true })).toBeNull()
  expect(defaultIndicatorConfig().operations).toEqual({})
})

it('applies the scoped thresholds to fresh completed foreground work and recovers on fresh samples', () => {
  const monitor = new IndicatorMonitor(fixtureTargetConfiguration(scope)!)
  const base = new DiagnosticRecorder().snapshot()
  const { attentionMs, criticalMs } = fixtureTargets['directory-1000']
  const snapshot = (now: number, durations: number[]) => ({
    ...base,
    running: true,
    samples: [now - 2000, now - 1000, now].map((observedAtMs) => ({
      observedAtMs,
      frameIntervalMs: 16,
      longTaskMs: 0,
      jsHeapBytes: null,
    })),
    timings: durations.map((durationMs, i) => ({
      metric: 'library.scan' as const,
      outcome: 'completed' as const,
      durationMs,
      startedAtMs: now - 2000 + i * 500,
      endedAtMs: now - 1000 + i * 500,
    })),
  })
  expect(monitor.update(snapshot(3000, [criticalMs, criticalMs]), 3000).state).toBe('recording')
  expect(monitor.update(snapshot(4000, [attentionMs, attentionMs, attentionMs]), 4000).state).toBe(
    'attention',
  )
  expect(monitor.update(snapshot(5000, [criticalMs, criticalMs, criticalMs]), 5000).state).toBe(
    'critical',
  )
  const recovered = snapshot(6000, [100, 100, 100])
  expect(monitor.update(recovered, 6000).state).toBe('critical')
  expect(monitor.update(recovered, 6000).explanation).toContain('1/3')
  expect(monitor.update(snapshot(7000, [100, 100, 100]), 7000).state).toBe('critical')
  expect(monitor.update(snapshot(8000, [100, 100, 100]), 8000).state).toBe('recording')
  expect(monitor.history[1]?.configuration.operations['library.scan']?.attentionMs).toBe(
    attentionMs,
  )
  expect(
    monitor.update(snapshot(9000, [criticalMs, criticalMs, criticalMs]), 9000, false).state,
  ).toBe('inactive')
})
