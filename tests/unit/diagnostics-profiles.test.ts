import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { DiagnosticRecorder } from '../../src/features/diagnostics/recorder'
import {
  ResourceInvestigation,
  type InvestigationSnapshot,
} from '../../src/features/diagnostics/resource-investigation'
import { IndicatorMonitor } from '../../src/features/diagnostics/indicators'
import {
  readerProfileStats,
  profileTimings,
} from '../../src/features/diagnostics/operation-profiles'
import IndicatorTargets from '../../src/features/diagnostics/IndicatorTargets.vue'
import ReaderProfiles from '../../src/features/diagnostics/ReaderProfiles.vue'
function responsive() {
  return {
    ...new DiagnosticRecorder().snapshot(),
    running: true,
    samples: [1000, 2000, 3000].map((observedAtMs) => ({
      observedAtMs,
      frameIntervalMs: 16,
      longTaskMs: null,
      jsHeapBytes: null,
    })),
  }
}
function evidence(
  profile: InvestigationSnapshot['timings'][number]['operation'],
  durations = [70, 70, 70],
): InvestigationSnapshot {
  return {
    ...new ResourceInvestigation().snapshot({}, null),
    active: true,
    timings: durations.map((durationMs, i) => ({
      operation: profile,
      queuedAtMs: 500 + i * 1000,
      endedAtMs: 1000 + i * 1000,
      waitMs: 0,
      processingMs: durationMs,
      durationMs,
      outcome: 'completed',
      failure: null,
    })),
  }
}
it('keeps cold, restored, expired and warm expectations independent and unconfigured by default', () => {
  const m = new IndicatorMonitor(),
    s = responsive(),
    r = evidence('pdf.cold-open')
  expect(m.config.version).toBe(2)
  expect(m.update(s, 3000, true, r).findings).toEqual([])
  m.config.operations['pdf.warm-activate'] = { attentionMs: 50, criticalMs: 100 }
  expect(m.update(s, 3000, true, r).findings).toEqual([])
  r.timings.push(...evidence('pdf.warm-activate').timings)
  const result = m.update(s, 3000, true, r)
  expect(result.findings.map((f) => f.id)).toEqual(['pdf.warm-activate'])
  expect(result.findings[0]?.reason).toContain('PDF warm selection dispatch')
  expect(m.history.at(-1)?.configuration.operations['pdf.cold-open']).toBeUndefined()
  expect(m.history.at(-1)?.context.some((t) => t.metric === 'pdf.warm-activate')).toBe(true)
})
it('does not inflate completed series with cancelled, failed, out-of-window or pre-background work', () => {
  const m = new IndicatorMonitor(),
    s = responsive(),
    r = evidence('epub.expired-open')
  m.config.operations['epub.expired-open'] = { attentionMs: 50, criticalMs: 100 }
  r.timings[1]!.outcome = 'cancelled'
  r.timings[2]!.outcome = 'failed'
  expect(m.update(s, 3000, true, r).findings).toEqual([])
  r.timings = evidence('epub.expired-open').timings
  m.update(s, 2500, false, r)
  expect(m.update(s, 3000, true, r).findings).toEqual([])
  m.restart(4000)
  expect(m.update(s, 4000, true, r).findings).toEqual([])
  expect(profileTimings(s, evidence('reading.restore'))).toHaveLength(0)
})
it('evaluates pending age only for the configured live profile, not five-minute retention timers or old epochs', () => {
  const m = new IndicatorMonitor(),
    s = responsive(),
    r = evidence('pdf.cold-open', [])
  r.pending = [{ operation: 'pdf.cold-open', queuedAtMs: 1000, phase: 'processing', ageMs: 2000 }]
  m.config.pending['pdf.restored-open'] = { attentionMs: 500, criticalMs: 1500 }
  expect(m.update(s, 3000, true, r).findings).toEqual([])
  m.config.pending['pdf.cold-open'] = { attentionMs: 500, criticalMs: 1500 }
  expect(m.update(s, 3000, true, r).findings[0]?.id).toBe('pending:pdf.cold-open')
  m.update(s, 3500, false, r)
  expect(m.update(s, 4000, true, r).findings).toEqual([])
  r.pending = [
    { operation: 'pdf.reader-release', queuedAtMs: 0, phase: 'processing', ageMs: 300000 },
  ]
  expect(m.update(s, 4000, true, r).findings).toEqual([])
})
it('separates completed statistics and withholds p95 until 20 completions in that exact profile', () => {
  const r = evidence('pdf.cold-open', [10, 20, 30])
  r.timings.push(...evidence('pdf.warm-activate', Array(20).fill(2)).timings)
  r.timings.push({ ...r.timings[0]!, outcome: 'cancelled', durationMs: 99999 })
  const rows = readerProfileStats(r)
  expect(rows.find((row) => row.metric === 'pdf.cold-open')).toMatchObject({
    count: 3,
    last: 30,
    median: 20,
    worst: 30,
    p95: null,
    cancelled: 1,
  })
  expect(rows.find((row) => row.metric === 'pdf.warm-activate')).toMatchObject({
    count: 20,
    median: 2,
    p95: 2,
  })
  expect(rows.find((row) => row.metric === 'pdf.expired-open')).toMatchObject({
    count: 0,
    last: null,
    p95: null,
  })
})
it('loads the selected saved target, uses blank unconfigured inputs, and applies/removes just that profile and rule', async () => {
  const m = new IndicatorMonitor()
  m.config.operations['pdf.cold-open'] = { attentionMs: 50, criticalMs: 100 }
  m.config.pending['pdf.cold-open'] = { attentionMs: 500, criticalMs: 1000 }
  const wrapper = mount(IndicatorTargets, { props: { config: m.config } })
  expect(wrapper.findAll('input').map((i) => i.element.value)).toEqual(['', ''])
  await wrapper.findAll('select')[0]!.setValue('pdf.cold-open')
  expect(wrapper.findAll('input').map((i) => i.element.value)).toEqual(['50', '100'])
  await wrapper.findAll('select')[1]!.setValue('pending')
  expect(wrapper.findAll('input').map((i) => i.element.value)).toEqual(['500', '1000'])
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('apply')?.[0]).toEqual([
    'pdf.cold-open',
    'pending',
    { attentionMs: 500, criticalMs: 1000 },
  ])
  await wrapper.findAll('button')[1]!.trigger('click')
  expect(wrapper.emitted('apply')?.[1]).toEqual(['pdf.cold-open', 'pending', null])
  await wrapper.findAll('select')[0]!.setValue('epub.warm-activate')
  expect(wrapper.findAll('input').map((i) => i.element.value)).toEqual(['', ''])
  expect(wrapper.text()).toContain('not measure browser paint')
  wrapper.unmount()
})
it('shows lifecycle evidence with accessible labels and target coverage without inventing a health pass', () => {
  const m = new IndicatorMonitor()
  const wrapper = mount(ReaderProfiles, {
    props: { snapshot: evidence('pdf.cold-open'), config: m.config },
  })
  expect(wrapper.find('section').attributes('aria-label')).toBe('Reader lifecycle profiles')
  expect(wrapper.text()).toContain('Collecting (3/20)')
  expect(wrapper.text()).toContain('Duration unconfigured')
  expect(wrapper.findAll('tbody tr')).toHaveLength(8)
  expect(wrapper.findAll('[title]')).toHaveLength(0)
  wrapper.unmount()
})
it('exports resource/heap changes as informational observations without turning expected retained ownership into warnings', () => {
  const r = new ResourceInvestigation(),
    m = new IndicatorMonitor()
  r.markBaseline({ viewers: 0, ownedListeners: 0 }, 100)
  const changes = r.snapshot({ viewers: 2, ownedListeners: 17 }, 200)
  expect(changes.observations).toEqual([
    { key: 'viewers', delta: 2 },
    { key: 'ownedListeners', delta: 17 },
    { key: 'jsHeapBytes', delta: 100 },
  ])
  expect(m.update(responsive(), 3000, true, changes).findings).toEqual([])
  expect(r.snapshot({}, null).observations.some((o) => o.key === 'jsHeapBytes')).toBe(false)
  r.reset()
  expect(r.snapshot({ viewers: 2 }, 200).observations).toEqual([])
})

it('starts a fresh epoch on foreground return, excluding operations begun after the last hidden refresh', () => {
  const m = new IndicatorMonitor(),
    s = responsive(),
    r = evidence('epub.cold-open')
  m.config.operations['epub.cold-open'] = { attentionMs: 50, criticalMs: 100 }
  m.update(s, 2500, false, r)
  r.timings.forEach((row, i) => {
    row.queuedAtMs = 2700 + i * 100
    row.endedAtMs = 2800 + i * 100
  })
  expect(m.update(s, 3000, true, r).findings).toEqual([])
  expect(m.update(s, 3000, true, r).state).toBe('collecting')
})
