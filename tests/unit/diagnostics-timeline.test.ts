import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { buildTimeline, timelineTime } from '../../src/features/diagnostics/timeline'
import {
  defaultIndicatorConfig,
  type IndicatorEvent,
} from '../../src/features/diagnostics/indicators'
import DiagnosticTimeline from '../../src/features/diagnostics/DiagnosticTimeline.vue'
import { DiagnosticRecorder } from '../../src/features/diagnostics/recorder'
function event(atMs: number, state: IndicatorEvent['state'], peak = 60): IndicatorEvent {
  return {
    atMs,
    lastSeenAtMs: atMs + 1000,
    state,
    findingIds: state === 'attention' || state === 'critical' ? ['frames'] : [],
    evaluations: 3,
    findings:
      state === 'attention' || state === 'critical'
        ? [
            {
              id: 'frames',
              state,
              reason: 'Measured frame interval exceeded the provisional target.',
              next: 'Inspect main-thread layout in a trace.',
              observedMs: peak,
              thresholdMs: state === 'critical' ? 150 : 50,
            },
          ]
        : [],
    explanation: 'Observed state transition.',
    configuration: defaultIndicatorConfig(),
    context: [],
  }
}
const events = () => [
  event(0, 'collecting'),
  event(1000, 'attention'),
  event(4000, 'critical', 182),
  event(14000, 'recording'),
  event(30000, 'attention'),
  event(42000, 'recording'),
]
it('groups escalation and recovery into incidents, retains causes and orders operations without duplicating them', () => {
  const history = events(),
    original = JSON.stringify(history)
  const m = buildTimeline(history, [
    { metric: 'pdf.render', outcome: 'completed', durationMs: 100, endedAtMs: 5000 },
    { metric: 'pdf.render', outcome: 'cancelled', durationMs: 30, endedAtMs: 20000 },
  ])
  expect(m.incidents).toHaveLength(2)
  expect(buildTimeline(history.slice(1), []).incidents[0]?.id).toBe(m.incidents[0]?.id)
  expect(m.incidents[0]).toMatchObject({
    state: 'critical',
    status: 'Recovered',
    atMs: 1000,
    endMs: 14000,
  })
  expect(m.incidents[0]?.transitions.map((e) => e.state)).toEqual([
    'attention',
    'critical',
    'recording',
  ])
  expect(m.incidents[0]?.findings[0]?.observedMs).toBe(182)
  expect(m.incidents[0]?.operations).toHaveLength(1)
  expect(m.rows.map((row) => row.kind)).toEqual(['transition', 'incident', 'operation', 'incident'])
  expect(m.eventCount).toBe(8)
  expect(m.transitions).toHaveLength(6)
  expect(JSON.stringify(history)).toBe(original)
})
it('does not merge across interrupted evaluation, infer recovery or position timestamp-free operations', () => {
  const m = buildTimeline(
    [event(1000, 'attention'), event(2000, 'inactive'), event(3000, 'attention')],
    [{ metric: 'epub.chapter', outcome: 'completed', durationMs: 10 }],
  )
  expect(m.incidents.map((i) => i.status)).toEqual(['Interrupted', 'Active'])
  expect(m.unpositionedOperations).toBe(1)
  expect(m.eventCount).toBe(3)
  expect(timelineTime(65000)).toBe('01:05')
})
it('matches the approved three-filter timeline, incident labels, expandable evidence and chronological transitions', async () => {
  const snapshot = {
    ...new DiagnosticRecorder().snapshot(),
    timings: [
      {
        metric: 'pdf.render' as const,
        outcome: 'cancelled' as const,
        durationMs: 15,
        endedAtMs: 20000,
      },
    ],
  }
  const wrapper = mount(DiagnosticTimeline, { props: { history: events(), snapshot } })
  expect(wrapper.findAll('.filters button').map((b) => b.text())).toEqual([
    'All events',
    'Incidents only',
    'Transitions only',
  ])
  expect(wrapper.findAll('.entry')).toHaveLength(4)
  const first = wrapper.get('button[aria-expanded]')
  expect(first.attributes('aria-expanded')).toBe('true')
  expect(wrapper.text()).toContain('Recovered')
  expect(wrapper.text()).toContain('182 ms')
  expect(wrapper.text()).toContain('Investigate next')
  await first.trigger('click')
  expect(first.attributes('aria-expanded')).toBe('false')
  await wrapper.findAll('.filters button')[1]!.trigger('click')
  expect(wrapper.findAll('.entry')).toHaveLength(2)
  await wrapper.findAll('.filters button')[2]!.trigger('click')
  expect(wrapper.findAll('.entry')).toHaveLength(6)
  expect(wrapper.text()).not.toContain('PDF page render · cancelled')
  wrapper.unmount()
})
it('keeps critical evidence ahead of a numerically larger attention reading from another signal', () => {
  const attention = event(1000, 'attention', 500)
  attention.findings[0]!.id = 'long-tasks'
  const critical = event(2000, 'critical', 182)
  const model = buildTimeline([attention, critical, event(5000, 'recording')], [])
  expect(model.incidents[0]?.evidence.state).toBe('critical')
  expect(model.incidents[0]?.findings).toHaveLength(2)
})
