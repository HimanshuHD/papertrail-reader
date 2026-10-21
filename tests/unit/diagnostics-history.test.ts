import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import DiagnosticDashboard from '../../src/features/diagnostics/DiagnosticDashboard.vue'
import { IndicatorMonitor } from '../../src/features/diagnostics/indicators'
import { DiagnosticRecorder } from '../../src/features/diagnostics/recorder'
it('keeps recovered warning explanations accessible in performance history', async () => {
  const m = new IndicatorMonitor()
  const snapshot = {
    ...new DiagnosticRecorder().snapshot(),
    running: true,
    samples: [1000, 2000, 3000].map((observedAtMs) => ({
      observedAtMs,
      frameIntervalMs: 60,
      longTaskMs: null,
      jsHeapBytes: null,
    })),
  }
  m.update(snapshot, 3000)
  const warning = m.history[0]!
  warning.endedAtMs = 6000
  warning.resolution = 'recovered'
  const wrapper = mount(DiagnosticDashboard, {
    props: { snapshot, capabilities: {}, indicatorHistory: m.history },
  })
  await wrapper.findAll('[role=tab]')[3]!.trigger('click')
  expect(wrapper.text()).toContain('Session timeline')
  const history = wrapper.get('.session-timeline')
  expect(history.text()).toContain('Recovered')
  expect(history.get('button[aria-expanded]').attributes('aria-expanded')).toBe('true')
  expect(history.text()).toContain('Foreground frame interval')
  expect(history.text()).toContain('60 ms')
  expect(history.text()).toContain('Inspect main-thread')
  expect(history.text()).toContain('does not establish the root cause')
  expect(history.text()).toContain('Captured rules')
  wrapper.unmount()
})
