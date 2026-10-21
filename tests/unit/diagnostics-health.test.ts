import { expect, it } from 'vitest'
import { triggerHealth } from '../../src/features/diagnostics/health'
const sample = (frameIntervalMs: number | null, longTaskMs: number | null = 0) => ({
  frameIntervalMs,
  longTaskMs,
  jsHeapBytes: null,
})
it('keeps inactive gray, defaults recording green, and requires sustained provisional responsiveness signals', () => {
  expect(triggerHealth(false, [sample(200), sample(200), sample(200)]).state).toBe('inactive')
  expect(triggerHealth(true, []).state).toBe('recording')
  expect(triggerHealth(true, [sample(null, null)]).state).toBe('recording')
  expect(triggerHealth(true, [sample(16), sample(16), sample(200)]).state).toBe('recording')
  expect(triggerHealth(true, [sample(60), sample(60), sample(60)]).state).toBe('attention')
  expect(
    triggerHealth(true, [sample(null, 1200), sample(null, 1200), sample(null, 1200)]).state,
  ).toBe('critical')
  expect(triggerHealth(true, [sample(200), sample(16), sample(16)]).state).toBe('recording')
})
