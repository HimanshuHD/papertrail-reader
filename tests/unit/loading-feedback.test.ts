import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoadingState from '../../src/components/LoadingState.vue'
import { waitForMinimumLoading } from '../../src/features/library/loading-duration'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
})
afterEach(() => vi.useRealTimers())

describe('library minimum loading duration', () => {
  it('holds a fast successful scan until three seconds from its start', async () => {
    const done = vi.fn()
    const waiting = waitForMinimumLoading(0, new AbortController().signal).then(done)
    await vi.advanceTimersByTimeAsync(2999)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await waiting
    expect(done).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not add another delay after a scan already took three seconds', async () => {
    vi.setSystemTime(4000)
    await waitForMinimumLoading(0, new AbortController().signal)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('releases a pending wait and clears its timer immediately on cancellation', async () => {
    const controller = new AbortController()
    const waiting = waitForMinimumLoading(0, controller.signal)
    expect(vi.getTimerCount()).toBe(1)
    controller.abort()
    await waiting
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('loading feedback lifecycle', () => {
  it('rotates decorative messages without repeating live announcements and clears timers on unmount', async () => {
    const wrapper = mount(LoadingState, {
      props: { label: 'Loading your library', rotateMessages: true, announce: false },
    })
    expect(wrapper.attributes('aria-live')).toBe('off')
    expect(wrapper.get('.loading-message').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('Loading your documents…')
    await vi.advanceTimersByTimeAsync(2500)
    expect(wrapper.text()).toContain('Thanks for your patience')
    await vi.advanceTimersByTimeAsync(2500)
    expect(wrapper.text()).toContain('Almost there')
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('uses static accessible PDF feedback without creating a message timer', () => {
    const wrapper = mount(LoadingState, {
      props: { label: 'Opening document', detail: 'chapter.pdf' },
    })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.text()).toContain('chapter.pdf')
    expect(vi.getTimerCount()).toBe(0)
    wrapper.unmount()
  })
})
