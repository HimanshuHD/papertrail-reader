import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ReadingStatisticsResetError } from '../../src/services/reading-statistics'
import { useReadingStatistics } from '../../src/composables/useReadingStatistics'
const mocked = vi.hoisted(() => ({ open: vi.fn(), checkpoint: vi.fn(), reset: vi.fn() }))
vi.mock('../../src/services/reading-statistics', () => ({
  ReadingStatisticsResetError: class extends Error {},
  ReadingStatisticsStorage: class {
    open = mocked.open
    checkpoint = mocked.checkpoint
    reset = mocked.reset
  },
}))
let visibility: DocumentVisibilityState = 'visible',
  focused = true
const fingerprint = ref<string | null>('sha256-chunks-v1:' + 'a'.repeat(64)),
  ready = ref(true),
  position = ref(0.2)
let api: ReturnType<typeof useReadingStatistics>
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused)
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  visibility = 'visible'
  focused = true
  ready.value = true
  position.value = 0.2
  fingerprint.value = 'sha256-chunks-v1:' + 'a'.repeat(64)
  mocked.open.mockReset()
  mocked.checkpoint.mockReset()
  mocked.reset.mockReset()
  let counter = 0
  mocked.open.mockImplementation(async (identity) => ({
    handle: { id: identity.fingerprint, generation: 'epoch', sessionId: String(++counter) },
    summary: {
      version: 1,
      id: identity.fingerprint,
      generation: 'epoch',
      activeMs: 0,
      visits: 0,
      lastPosition: 0,
      furthestPosition: 0,
      updatedAt: 0,
    },
  }))
  mocked.checkpoint.mockImplementation(async (handle, ms, point) => ({
    version: 1,
    id: handle.id,
    generation: 'epoch',
    activeMs: ms,
    visits: ms > 0 ? 1 : 0,
    lastPosition: point,
    furthestPosition: point,
    updatedAt: 1,
  }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})
async function start() {
  wrapper = mount(
    defineComponent({
      setup() {
        api = useReadingStatistics('PDF', fingerprint, ready, position)
        return {}
      },
      template: '<section aria-label="PDF reader"><p>Text</p></section>',
    }),
    { attachTo: document.body },
  )
  await vi.advanceTimersByTimeAsync(0)
}
it('excludes hidden/blurred/loading time and flushes transitions without duplicating elapsed time', async () => {
  await start()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(api.activeMs.value).toBe(10_000)
  visibility = 'hidden'
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(20_000)
  expect(api.activeMs.value).toBe(10_000)
  visibility = 'visible'
  document.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(5_000)
  focused = false
  window.dispatchEvent(new Event('blur'))
  await vi.advanceTimersByTimeAsync(20_000)
  expect(api.activeMs.value).toBe(15_000)
  focused = true
  window.dispatchEvent(new Event('focus'))
  ready.value = false
  await nextTick()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(api.activeMs.value).toBe(15_000)
  ready.value = true
  await nextTick()
  await vi.advanceTimersByTimeAsync(2_000)
  window.dispatchEvent(new Event('pagehide'))
  await vi.advanceTimersByTimeAsync(0)
  expect(mocked.checkpoint.mock.calls.at(-1)?.[1]).toBe(17_000)
})
it('stops at the idle deadline, resumes on reader interaction, and flushes owned document before switching', async () => {
  await start()
  await vi.advanceTimersByTimeAsync(100_000)
  expect(api.activeMs.value).toBe(60_000)
  expect(api.idle.value).toBe(true)
  wrapper!.get('p').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  await vi.advanceTimersByTimeAsync(5_000)
  expect(api.activeMs.value).toBe(65_000)
  const old = fingerprint.value
  fingerprint.value = 'sha256-chunks-v1:' + 'b'.repeat(64)
  await nextTick()
  await vi.advanceTimersByTimeAsync(0)
  expect(mocked.checkpoint.mock.calls.at(-1)?.[0].id).toBe(old)
  expect(mocked.checkpoint.mock.calls.at(-1)?.[1]).toBe(65_000)
  expect(api.activeMs.value).toBe(0)
})
it('keeps failed time available for explicit retry and clears failure only after a committed save', async () => {
  await start()
  mocked.checkpoint.mockRejectedValueOnce(new Error('quota'))
  await vi.advanceTimersByTimeAsync(15_000)
  expect(api.notice.value).toContain('could not be saved')
  expect(api.activeMs.value).toBe(15_000)
  api.retry()
  await vi.advanceTimersByTimeAsync(0)
  expect(api.notice.value).toBe('')
  expect(mocked.checkpoint.mock.calls.at(-1)?.[1]).toBe(15_000)
})

it('recovers after another tab resets insights without retrying stale cumulative time', async () => {
  await start()
  mocked.checkpoint.mockRejectedValueOnce(new ReadingStatisticsResetError())
  await vi.advanceTimersByTimeAsync(15_000)
  expect(api.notice.value).toContain('reset in another tab')
  expect(api.activeMs.value).toBe(0)
  api.retry()
  await vi.advanceTimersByTimeAsync(0)
  expect(mocked.open).toHaveBeenCalledTimes(2)
  expect(api.notice.value).toBe('')
  expect(api.activeMs.value).toBe(0)
})
