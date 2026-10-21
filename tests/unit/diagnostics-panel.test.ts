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
    .find((button) => button.attributes('aria-label') === 'Pause')!
    .trigger('click')
  expect(diagnostics.running).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  const exportButton = wrapper
    .findAll('button')
    .find((button) => button.attributes('aria-label') === 'Export local JSON')!
  await exportButton.trigger('click')
  expect(downloadJson).toHaveBeenCalledOnce()
  const summary = JSON.parse(vi.mocked(downloadJson).mock.calls[0]![0])
  expect(summary.timings[0].metric).toBe('pdf.render')
  expect(summary.capabilities.memory).toMatch(/Unavailable/)
  expect(summary.samplerOverhead.samples).toBe(1)
  const previous = diagnostics.session
  await wrapper
    .findAll('button')
    .find((button) => button.attributes('aria-label') === 'Reset session')!
    .trigger('click')
  expect(diagnostics.session).not.toBe(previous)
  expect(diagnostics.timings).toHaveLength(0)
  await wrapper
    .findAll('button')
    .find((button) => button.attributes('aria-label') === 'Close diagnostics')!
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

it('additional sensors remain opt-in, continue minimized, stop paused/closed and reset retained readings', async () => {
  vi.useFakeTimers()
  const instances: { disconnect: ReturnType<typeof vi.fn> }[] = []
  vi.stubGlobal(
    'PerformanceObserver',
    class {
      static supportedEntryTypes = ['event', 'long-animation-frame', 'resource']
      disconnect = vi.fn()
      constructor() {
        instances.push(this)
      }
      observe() {}
      takeRecords() {
        return []
      }
    },
  )
  const wrapper = mount(DeveloperDiagnostics, { attachTo: document.body })
  const button = (name: string) =>
    wrapper.findAll('button').find((b) => b.attributes('aria-label') === name)!
  const exportSensors = async () => {
    await button('Export local JSON').trigger('click')
    return JSON.parse(vi.mocked(downloadJson).mock.calls.at(-1)![0]).responsiveness
  }
  try {
    await wrapper.get('button[aria-controls]').trigger('click')
    expect(instances).toHaveLength(0)
    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(instances).toHaveLength(3)
    expect((await exportSensors()).active).toBe(true)
    await button('Minimize diagnostics').trigger('click')
    expect(instances.every((o) => !o.disconnect.mock.calls.length)).toBe(true)
    await wrapper.get('button[aria-controls]').trigger('click')
    await button('Pause').trigger('click')
    expect(instances.every((o) => o.disconnect.mock.calls.length === 1)).toBe(true)
    expect((await exportSensors()).active).toBe(false)
    await button('Resume').trigger('click')
    expect(instances).toHaveLength(6)
    await button('Reset session').trigger('click')
    expect(instances).toHaveLength(9)
    expect((await exportSensors()).inputs).toEqual([])
    await button('Close diagnostics').trigger('click')
    expect(instances.every((o) => o.disconnect.mock.calls.length === 1)).toBe(true)
  } finally {
    wrapper.unmount()
    vi.unstubAllGlobals()
  }
})
