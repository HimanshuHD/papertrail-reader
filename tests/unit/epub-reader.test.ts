import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { expect, it, vi } from 'vitest'
import type { EpubSession } from '../../src/features/epub/epub-session'
import { useEpubReader } from '../../src/composables/useEpubReader'

const mocked = vi.hoisted(() => ({
  open: vi.fn<(file: Blob, target: HTMLElement, signal: AbortSignal) => Promise<EpubSession>>(),
}))
vi.mock('../../src/features/epub/epub-session', () => ({ openEpubSession: mocked.open }))
function session(): EpubSession {
  return {
    title: 'test',
    contents: [],
    contentsSource: 'spine',
    typography: vi.fn(),
    chapters: [
      { label: 'one', href: 'one' },
      { label: 'two', href: 'two' },
    ],
    display: vi.fn(async () => {}),
    appearance: vi.fn(),
    destroy: vi.fn(),
  }
}
function harness() {
  let reader!: ReturnType<typeof useEpubReader>
  const wrapper = mount({
    setup() {
      reader = useEpubReader()
      return () => h('div')
    },
  })
  return { reader, wrapper }
}

it('rejects a late open after switching sources and disposes only the old session', async () => {
  let finish!: (session: EpubSession) => void
  mocked.open.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const old = session()
  const current = session()
  mocked.open.mockResolvedValueOnce(current)
  const { reader, wrapper } = harness()
  const pending = reader.open(new File([], 'old.epub'), document.createElement('div'), false)
  await reader.open(new File([], 'new.epub'), document.createElement('div'), true)
  expect(mocked.open.mock.calls[0]![2].aborted).toBe(true)
  finish(old)
  await pending
  expect(old.destroy).toHaveBeenCalledTimes(1)
  expect(current.destroy).not.toHaveBeenCalled()
  expect(reader.session.value).toBe(current)
  expect(current.appearance).toHaveBeenCalledWith(true)
  await reader.go(1)
  expect(reader.chapter.value).toBe(1)
  wrapper.unmount()
  expect(current.destroy).toHaveBeenCalledTimes(1)
})

it('ignores stale navigation and clears the owned session on unmount', async () => {
  const current = session()
  let finish!: () => void
  vi.mocked(current.display).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  mocked.open.mockResolvedValueOnce(current)
  const { reader, wrapper } = harness()
  await reader.open(new File([], 'book.epub'), document.createElement('div'), false)
  const navigation = reader.go(1)
  wrapper.unmount()
  finish()
  await navigation
  expect(reader.chapter.value).toBe(0)
  expect(reader.busy.value).toBe(false)
  expect(reader.session.value).toBeNull()
  expect(current.destroy).toHaveBeenCalledTimes(1)
})

it('recovers from rejected opens without retaining an engine or busy state', async () => {
  mocked.open.mockRejectedValueOnce(new Error('malformed publication'))
  const { reader, wrapper } = harness()
  await reader.open(new File([], 'book.epub'), document.createElement('div'), false)
  expect(reader.error.value).toBe('malformed publication')
  expect(reader.session.value).toBeNull()
  expect(reader.busy.value).toBe(false)
  wrapper.unmount()
})

it('ignores late contents navigation after source replacement and resets the selected entry', async () => {
  const old = session()
  const next = session()
  let finish!: () => void
  vi.mocked(old.display).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  mocked.open.mockResolvedValueOnce(old).mockResolvedValueOnce(next)
  const { reader, wrapper } = harness()
  await reader.open(new File([], 'one.epub'), document.createElement('div'), false)
  const pending = reader.go(1, 'anchor', 'selected')
  await reader.open(new File([], 'two.epub'), document.createElement('div'), false)
  finish()
  await pending
  expect(reader.session.value).toBe(next)
  expect(reader.chapter.value).toBe(0)
  expect(reader.contentsEntry.value).toBeNull()
  wrapper.unmount()
})
