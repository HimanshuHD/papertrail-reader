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

it.each(Object.entries(fixtureTargets))(
  '%s requires sustained foreground breaches and fresh recovery',
  (fixture, { profile, attentionMs, criticalMs }) => {
    const monitor = new IndicatorMonitor(fixtureTargetConfiguration({ ...scope, fixture })!)
    const recorder = new DiagnosticRecorder()
    const base = recorder.snapshot()
    const investigation = recorder.investigation.snapshot({}, null)
    const update = (now: number, durations: number[], foreground = true) => {
      const timings = durations.map((durationMs, i) => ({
        outcome: 'completed' as const,
        durationMs,
        startedAtMs: now - 2000 + i * 500,
        endedAtMs: now - 1000 + i * 500,
      }))
      const snapshot = {
        ...base,
        running: true,
        samples: [now - 2000, now - 1000, now].map((observedAtMs) => ({
          observedAtMs,
          frameIntervalMs: 16,
          longTaskMs: 0,
          jsHeapBytes: null,
        })),
        timings: profile === 'library.scan' ? timings.map((t) => ({ ...t, metric: profile })) : [],
      }
      return monitor.update(snapshot, now, foreground, {
        ...investigation,
        timings:
          profile === 'library.scan'
            ? []
            : timings.map((t) => ({
                ...t,
                operation: profile,
                queuedAtMs: t.startedAtMs,
                waitMs: 0,
                processingMs: t.durationMs,
                failure: null,
              })),
      })
    }

    expect(update(3000, [criticalMs, criticalMs]).state).toBe('recording')
    expect(update(4000, [attentionMs, attentionMs, attentionMs]).state).toBe('attention')
    expect(update(5000, [criticalMs, criticalMs, criticalMs]).state).toBe('critical')
    expect(update(6000, [100, 100, 100]).state).toBe('critical')
    expect(update(6000, [100, 100, 100]).explanation).toContain('1/3')
    expect(update(7000, [100, 100, 100]).state).toBe('critical')
    expect(update(8000, [100, 100, 100]).state).toBe('recording')
    expect(monitor.history[1]?.configuration.operations[profile]?.attentionMs).toBe(attentionMs)
    expect(update(9000, [criticalMs, criticalMs, criticalMs], false).state).toBe('inactive')
  },
)
