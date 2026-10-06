import { afterEach, expect, it, vi } from 'vitest'
import { toasts, showToast, dismissToast } from '../../src/composables/useToasts'
afterEach(() => {
  toasts.value.forEach((item) => dismissToast(item.id))
  vi.useRealTimers()
})
it('bounds notifications, supports explicit dismissal and expires each message', () => {
  vi.useFakeTimers()
  showToast('Highlight saved.')
  showToast('Note saved.')
  showToast('Third')
  showToast('Fourth')
  expect(toasts.value.map((item) => item.message)).toEqual(['Note saved.', 'Third', 'Fourth'])
  dismissToast(toasts.value[1]!.id)
  expect(toasts.value.map((item) => item.message)).toEqual(['Note saved.', 'Fourth'])
  vi.advanceTimersByTime(4500)
  expect(toasts.value).toEqual([])
})
