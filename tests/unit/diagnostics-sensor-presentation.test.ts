import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { ResponsivenessSensors } from '../../src/features/diagnostics/responsiveness'
import { sensorStats, sensorView } from '../../src/features/diagnostics/sensor-presentation'
import DiagnosticSensors from '../../src/features/diagnostics/DiagnosticSensors.vue'
it('computes retained statistics with conservative p95 and preserves unsupported missing fields', () => {
  expect(sensorStats([])).toEqual({ count: 0, median: null, worst: null, p95: null })
  expect(sensorStats([2, 4, Infinity, -1])).toEqual({ count: 2, median: 3, worst: 4, p95: null })
  expect(sensorStats(Array.from({ length: 20 }, (_, i) => i + 1)).p95).toBe(19)
  const s = new ResponsivenessSensors().snapshot()
  s.inputs = [
    { atMs: 30, waitMs: 10, handlerMs: 15, durationMs: 40 },
    { atMs: 10, waitMs: 2, handlerMs: 3, durationMs: 16 },
  ]
  expect(sensorView(s, 'inputs')).toMatchObject({
    values: [16, 40],
    latest: 40,
    breakdown: [
      { label: 'Waiting to run', value: 10 },
      { label: 'Handler processing', value: 15 },
    ],
  })
  expect(sensorView(s, 'frames').breakdown.every((r) => r.value === null)).toBe(true)
})
it('shows real values, neutral empty/unsupported states and category-specific reading guidance', async () => {
  const s = new ResponsivenessSensors().snapshot()
  s.inputs = [{ atMs: 10, waitMs: 12, handlerMs: 18, durationMs: 64 }]
  s.resources = [
    { atMs: 12, category: 'script', durationMs: 42, transferBytes: 0, encodedBytes: null },
  ]
  const wrapper = mount(DiagnosticSensors, { props: { snapshot: s, enabled: false } })
  expect(wrapper.text()).toContain('64 ms')
  expect(wrapper.text()).toContain('Not enough data')
  expect(wrapper.text()).toContain('Sensors off')
  expect(wrapper.get('details').text()).toContain('Requested event duration ≥ 16 ms')
  await wrapper.get('input').setValue(true)
  expect(wrapper.emitted('toggle')).toHaveLength(1)
  await wrapper.findAll('[role=tab]')[1]!.trigger('click')
  expect(wrapper.text()).toContain('Phases overlap')
  expect(wrapper.text()).toContain('Unavailable')
  expect(wrapper.text()).toContain('Event / callback / other')
  expect(wrapper.findAll('.track .fill').every((r) => r.attributes('style') === 'width: 0%;')).toBe(
    true,
  )
  await wrapper.findAll('[role=tab]')[2]!.trigger('click')
  expect(wrapper.get('details').text()).toContain('0 bytes')
  expect(wrapper.get('details').text()).toContain('cache, restricted cross-origin')
  expect(wrapper.text()).toContain('42 ms')
})
