import type { Snapshot } from './presentation'
/** Provisional UI signals, not calibrated workload budgets or a general performance verdict. */
export const triggerRules = {
  version: 1,
  sustainedSamples: 3,
  attention: { frameIntervalMs: 50, longTaskMs: 200 },
  critical: { frameIntervalMs: 150, longTaskMs: 1000 },
}
export function triggerHealth(running: boolean, samples: Snapshot['samples']) {
  if (!running) return { state: 'inactive', label: 'Sampling inactive' } as const
  const recent = samples.slice(-triggerRules.sustainedSamples)
  const sustained = (target: typeof triggerRules.attention) =>
    recent.length === triggerRules.sustainedSamples &&
    recent.every(
      (s) =>
        (s.frameIntervalMs !== null && s.frameIntervalMs >= target.frameIntervalMs) ||
        (s.longTaskMs !== null && s.longTaskMs >= target.longTaskMs),
    )
  if (sustained(triggerRules.critical))
    return {
      state: 'critical',
      label: 'Critical responsiveness signal · provisional thresholds',
    } as const
  if (sustained(triggerRules.attention))
    return {
      state: 'attention',
      label: 'Responsiveness needs attention · provisional thresholds',
    } as const
  return {
    state: 'recording',
    label: recent.length
      ? 'Recording · no sustained responsiveness issue detected'
      : 'Recording · collecting data',
  } as const
}
