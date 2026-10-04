import { Blob } from 'node:buffer'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createEpubFixture } from '../fixtures/epub'
import { openEpubSession } from '../../src/features/epub/epub-session'

const mocks = vi.hoisted(() => ({
  display: vi.fn(async () => {}),
  open: vi.fn(async () => {}),
  destroy: vi.fn(),
  render: vi.fn(),
  override: vi.fn(),
  resize: vi.fn(),
  on: vi.fn(),
}))
vi.mock('../../src/features/epub/scroll-layout', () => ({
  keepScrolledChapterMounted: () => vi.fn(),
}))
vi.mock('epubjs', () => ({
  default: () => ({
    open: mocks.open,
    destroy: mocks.destroy,
    renderTo: mocks.render.mockImplementation(() => ({
      display: mocks.display,
      resize: mocks.resize,
      on: mocks.on,
      themes: { default: vi.fn(), override: mocks.override },
    })),
  }),
}))
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())
const file = () => new Blob([createEpubFixture()]) as unknown as globalThis.File

it('owns an isolated root, renders inert text and disposes once without deleting siblings', async () => {
  const target = document.createElement('div')
  const sibling = document.createElement('span')
  target.append(sibling)
  const controller = new AbortController()
  const session = await openEpubSession(file(), target, controller.signal)
  expect(mocks.open).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'binary')
  expect(mocks.render).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ allowScriptedContent: false }),
  )
  await session.display(1)
  expect(mocks.display).toHaveBeenLastCalledWith('chapter-1.xhtml')
  session.appearance(true)
  expect(mocks.override).toHaveBeenCalledWith('color', '#e7e9ee', true)
  session.destroy()
  session.destroy()
  expect(mocks.destroy).toHaveBeenCalledTimes(1)
  expect(target.children).toHaveLength(1)
  expect(target.firstChild).toBe(sibling)
  await expect(session.display(0)).rejects.toThrow('unavailable')
})

it('defers engine teardown until a pending operation settles and prevents stale rendering', async () => {
  let finish!: () => void
  mocks.open.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const target = document.createElement('div')
  const controller = new AbortController()
  const opening = openEpubSession(file(), target, controller.signal)
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  controller.abort()
  expect(mocks.destroy).not.toHaveBeenCalled()
  const sibling = document.createElement('span')
  target.append(sibling)
  finish()
  await expect(opening).rejects.toThrow()
  expect(mocks.destroy).toHaveBeenCalledTimes(1)
  expect(mocks.render).not.toHaveBeenCalled()
  expect(target.firstChild).toBe(sibling)
})

it('cleans up a rejected engine open', async () => {
  mocks.open.mockRejectedValueOnce(new Error('engine rejected'))
  const target = document.createElement('div')
  await expect(openEpubSession(file(), target, new AbortController().signal)).rejects.toThrow(
    'engine rejected',
  )
  expect(target.children).toHaveLength(0)
  expect(mocks.destroy).toHaveBeenCalledTimes(1)
})

it('releases the root and engine while a navigation promise is still pending', async () => {
  const target = document.createElement('div')
  const controller = new AbortController()
  const session = await openEpubSession(file(), target, controller.signal)
  let finish!: () => void
  mocks.display.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const navigation = session.display(1)
  controller.abort()
  expect(target.children).toHaveLength(0)
  expect(mocks.destroy).toHaveBeenCalledTimes(1)
  finish()
  await expect(navigation).rejects.toThrow()
})

it('reflows on container resize, ignores zero sizes and cancels pending work on disposal', async () => {
  let notify!: ResizeObserverCallback
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        notify = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
  let scheduled: FrameRequestCallback | null = null
  const cancel = vi.fn(() => {
    scheduled = null
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    scheduled = callback
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', cancel)
  try {
    const target = document.createElement('div')
    const session = await openEpubSession(file(), target, new AbortController().signal)
    const root = target.firstElementChild!
    let width = 600
    Object.defineProperty(root, 'clientWidth', { get: () => width })
    Object.defineProperty(root, 'clientHeight', { get: () => 400 })
    const flush = () => {
      const callback = scheduled
      scheduled = null
      callback?.(0)
    }
    flush()
    expect(mocks.resize).toHaveBeenLastCalledWith(600, 400)
    width = 320
    notify([], {} as ResizeObserver)
    flush()
    expect(mocks.resize).toHaveBeenLastCalledWith(320, 400)
    width = 0
    notify([], {} as ResizeObserver)
    flush()
    expect(mocks.resize).toHaveBeenCalledTimes(2)
    width = 800
    notify([], {} as ResizeObserver)
    session.destroy()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledOnce()
    flush()
    expect(mocks.resize).toHaveBeenCalledTimes(2)
  } finally {
    vi.unstubAllGlobals()
  }
})
