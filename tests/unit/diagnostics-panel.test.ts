import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import DeveloperDiagnostics from '../../src/features/diagnostics/DeveloperDiagnostics.vue'
import { diagnostics } from '../../src/features/diagnostics/recorder'
import { downloadJson } from '../../src/services/file-download'
vi.mock('../../src/services/file-download', () => ({ downloadJson: vi.fn() }))
afterEach(() => {
  diagnostics.pause()
  diagnostics.reset()
  vi.useRealTimers()
  document.body.replaceChildren()
})
it('keeps sampling off until opened, exports locally, resets session and cleans up on close/unmount', async () => {
  vi.useFakeTimers()
  const raf = vi.spyOn(globalThis, 'requestAnimationFrame')
  const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame')
  const interval = vi.spyOn(globalThis, 'setInterval')
  const clear = vi.spyOn(globalThis, 'clearInterval')
  const wrapper = mount(DeveloperDiagnostics, { attachTo: document.body })
  expect(vi.getTimerCount()).toBe(0)
  const toggle = wrapper.get('button[aria-controls]')
  await toggle.trigger('click')
  expect(diagnostics.running).toBe(true)
  await wrapper
    .findAll('button')
    .find((button) => button.attributes('aria-label') === 'Minimize diagnostics')!
    .trigger('click')
  expect(wrapper.find('section').exists()).toBe(false)
  expect(diagnostics.running).toBe(true)
  expect(document.activeElement).toBe(toggle.element)
  await toggle.trigger('click')
  diagnostics.start('pdf.render')?.()
  vi.advanceTimersByTime(1000)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Pause')!
    .trigger('click')
  expect(diagnostics.running).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  const exportButton = wrapper
    .findAll('button')
    .find((button) => button.text() === 'Export local JSON')!
  await exportButton.trigger('click')
  expect(downloadJson).toHaveBeenCalledOnce()
  const summary = JSON.parse(vi.mocked(downloadJson).mock.calls[0]![0])
  expect(summary.timings[0].metric).toBe('pdf.render')
  expect(summary.capabilities.memory).toMatch(/Unavailable/)
  expect(summary.samplerOverhead.samples).toBe(1)
  const previous = diagnostics.session
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Reset session')!
    .trigger('click')
  expect(diagnostics.session).not.toBe(previous)
  expect(diagnostics.timings).toHaveLength(0)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === 'Close diagnostics')!
    .trigger('click')
  expect(document.activeElement).toBe(toggle.element)
  await toggle.trigger('click')
  expect(diagnostics.running).toBe(true)
  wrapper.unmount()
  vi.runAllTicks()

  expect(diagnostics.running).toBe(false)
  expect(clear).toHaveBeenCalledWith(interval.mock.results.at(-1)!.value)
  expect(cancel).toHaveBeenCalledWith(raf.mock.results.at(-1)!.value)
})
