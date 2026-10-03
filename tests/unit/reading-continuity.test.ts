import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { useReadingContinuity } from '../../src/composables/useReadingContinuity'
import type { ReadingStorage } from '../../src/services/reading-storage'

vi.mock('../../src/services/document-identity', () => ({
  fingerprintDocument: vi.fn(async (file: File) => file.name),
}))
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})

function setup(storage: ReadingStorage) {
  let continuity!: ReturnType<typeof useReadingContinuity>
  const wrapper = mount({
    setup() {
      continuity = useReadingContinuity(storage)
      return () => null
    },
  })
  wrappers.push(wrapper)
  return continuity
}
function storage(): ReadingStorage {
  return {
    resolve: vi.fn(async (fingerprint: string) => ({
      record: {
        id: fingerprint,
        fingerprint,
        version: 1 as const,
        name: fingerprint,
        page: 9,
        updatedAt: 0,
      },
      ambiguous: false,
    })),
    save: vi.fn(async () => undefined),
  }
}

it('clamps restored pages to the current document and serializes queued saves before reselection', async () => {
  vi.useFakeTimers()
  const repository = storage()
  const reader = setup(repository)
  expect(await reader.restore(new File([''], 'A'), 3)).toBe(3)
  reader.save(2)
  reader.save(3)
  await reader.restore(new File([''], 'B'), 20)
  expect(repository.save).toHaveBeenCalledExactlyOnceWith('A', 3)
  reader.save(4)
  reader.reset()
  await flushPromises()
  expect(repository.save).toHaveBeenLastCalledWith('B', 4)
})

it('never attaches a stale identity when the document changes during resolution', async () => {
  const repository = storage()
  let complete!: (value: Awaited<ReturnType<ReadingStorage['resolve']>>) => void
  vi.mocked(repository.resolve).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve
      }),
  )
  const reader = setup(repository)
  const first = reader.restore(new File([''], 'A'), 20)
  await flushPromises()
  await reader.restore(new File([''], 'B'), 20)
  complete({
    record: { id: 'A', version: 1, fingerprint: 'A', name: 'A', page: 7, updatedAt: 0 },
    ambiguous: false,
  })
  expect(await first).toBeNull()
  reader.save(5)
  reader.reset()
  await flushPromises()
  expect(repository.save).toHaveBeenCalledExactlyOnceWith('B', 5)
})

it('preserves ambiguous matches and reads without storage after failure', async () => {
  const repository = storage()
  vi.mocked(repository.resolve).mockResolvedValueOnce({
    record: { id: 'ambiguous', version: 1, fingerprint: 'x', name: 'x', page: 8, updatedAt: 0 },
    ambiguous: true,
  })
  const reader = setup(repository)
  expect(await reader.restore(new File([''], 'A'), 20)).toBeNull()
  reader.save(3)
  reader.reset()
  expect(repository.save).not.toHaveBeenCalled()
  vi.mocked(repository.resolve).mockRejectedValueOnce(new Error('Quota exceeded'))
  expect(await reader.restore(new File([''], 'B'), 20)).toBeNull()
  expect(reader.notice.value).toContain('unavailable')
})
