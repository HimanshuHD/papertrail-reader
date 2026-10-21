import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { DiagnosticRecorder, type Timing } from '../../src/features/diagnostics/recorder'
import {
  measurement,
  operationStats,
  trendSegments,
} from '../../src/features/diagnostics/presentation'
import DiagnosticDashboard from '../../src/features/diagnostics/DiagnosticDashboard.vue'

describe('diagnostic read model', () => {
  it('excludes cancelled, failed and invalid durations; calculates median and nearest-rank p95 only with enough samples', () => {
    const timings: Timing[] = Array.from({ length: 20 }, (_, i) => ({
      metric: 'pdf.render',
      durationMs: i + 1,
      outcome: 'completed',
    }))
    timings.push(
      { metric: 'pdf.render', durationMs: 9999, outcome: 'cancelled' },
      { metric: 'pdf.render', durationMs: 8888, outcome: 'failed' },
      { metric: 'pdf.render', durationMs: NaN, outcome: 'completed' },
    )
    const row = operationStats(timings).find((row) => row.metric === 'pdf.render')!
    expect(row).toMatchObject({
      count: 20,
      median: 10.5,
      last: 20,
      p95: 19,
      worst: 20,
      cancelled: 1,
      failed: 1,
    })
    expect(
      operationStats(timings.slice(0, 19)).find((row) => row.metric === 'pdf.render')?.p95,
    ).toBeNull()
    expect(operationStats([])[0]).toMatchObject({
      count: 0,
      median: null,
      last: null,
      p95: null,
      worst: null,
    })
  })
  it('preserves actual zero and unavailable, and breaks trends across missing values', () => {
    expect(measurement(0)).toBe('0 ms')
    expect(measurement(null)).toBe('Unavailable')
    expect(measurement(Infinity)).toBe('Unavailable')
    expect(trendSegments([null, null])).toEqual([])
    expect(trendSegments([2, 2])).toEqual(['0.00,21.00 100.00,21.00'])
    expect(trendSegments([1, null, 2])).toEqual(['0.00,36.00', '100.00,6.00'])
  })
})
it('shows neutral capability states, accurate outcomes and keyboard-accessible separate sections', async () => {
  const recorder = new DiagnosticRecorder()
  recorder.resume()
  recorder.resources({}, { viewers: 0, previewBytes: 1048576 })
  recorder.sample({ frameIntervalMs: null, longTaskMs: 0, jsHeapBytes: null })
  recorder.start('pdf.render')?.('cancelled')
  const wrapper = mount(DiagnosticDashboard, {
    attachTo: document.body,
    props: {
      snapshot: recorder.snapshot(),
      capabilities: { memory: 'Unavailable: browser unsupported', longTasks: 'Available' },
    },
  })
  expect(wrapper.text()).toContain('Targets not configured')
  expect(wrapper.text()).toContain('Unavailable: browser unsupported')
  expect(wrapper.text()).toContain('0 ms')
  const tabs = wrapper.findAll('[role=tab]')
  await tabs[0]!.trigger('keydown', { key: 'ArrowRight' })
  expect(tabs[1]!.attributes('aria-selected')).toBe('true')
  expect(document.activeElement).toBe(tabs[1]!.element)
  expect(wrapper.get('#diagnostic-view-Operations').text()).toContain('1 cancelled · 0 failed')
  await tabs[2]!.trigger('click')
  const resourcePanel = wrapper.get('#diagnostic-view-Resources')
  expect(resourcePanel.text()).toContain('No registered owner')
  expect(resourcePanel.text()).toContain('1 MiB estimated')
  expect(resourcePanel.findAll('dd')[0]!.text()).toBe('0')
  await tabs[2]!.trigger('keydown', { key: 'End' })
  expect(tabs[3]!.attributes('aria-selected')).toBe('true')
  expect(wrapper.get('#diagnostic-view-Timeline').text()).toContain('cancelled')
  expect(wrapper.get('#diagnostic-view-Timeline').text()).not.toContain('Critical')
  wrapper.unmount()
})
