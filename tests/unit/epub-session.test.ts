import { Blob } from 'node:buffer'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import {
  createEpubFixture,
  createFormattedEpubFixture,
  createContentsEpubFixture,
} from '../fixtures/epub'
import { openEpubSession } from '../../src/features/epub/epub-session'

const mocks = vi.hoisted(() => ({
  display: vi.fn(async () => {}),
  open: vi.fn(async () => {}),
  destroy: vi.fn(),
  render: vi.fn(),
  override: vi.fn(),
  resize: vi.fn(),
  on: vi.fn(),
  css: vi.fn(),
  hook: vi.fn(),
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
      hooks: { content: { register: mocks.hook } },
      getContents: () => [],
      themes: { default: vi.fn(), override: mocks.override, registerCss: mocks.css, add: vi.fn() },
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
  const session = await openEpubSession(file(), target, controller.signal, { textOnly: true })
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

it('debounces resize for 150ms after the last change and cancels queued work on disposal', async () => {
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
  try {
    const target = document.createElement('div')
    const session = await openEpubSession(file(), target, new AbortController().signal)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const root = target.firstElementChild!
    let width = 600
    Object.defineProperty(root, 'clientWidth', { get: () => width })
    Object.defineProperty(root, 'clientHeight', { get: () => 400 })
    notify([], {} as ResizeObserver)
    vi.advanceTimersByTime(149)
    expect(mocks.resize).not.toHaveBeenCalled()
    width = 320
    notify([], {} as ResizeObserver)
    vi.advanceTimersByTime(149)
    expect(mocks.resize).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(mocks.resize).toHaveBeenCalledExactlyOnceWith(320, 400)
    notify([], {} as ResizeObserver)
    vi.advanceTimersByTime(150)
    expect(mocks.resize).toHaveBeenCalledTimes(1)
    width = 0
    notify([], {} as ResizeObserver)
    vi.advanceTimersByTime(150)
    expect(mocks.resize).toHaveBeenCalledTimes(1)
    width = 800
    notify([], {} as ResizeObserver)
    session.destroy()
    expect(disconnect).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(150)
    expect(mocks.resize).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
})

it('opens the requested chapter and revokes formatted image URLs on session disposal and engine failure', async () => {
  const create = vi.fn(() => 'blob:owned-image')
  const revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const source = () => new Blob([createFormattedEpubFixture()]) as unknown as globalThis.Blob
  const session = await openEpubSession(
    source(),
    document.createElement('div'),
    new AbortController().signal,
    { chapter: 1 },
  )
  expect(mocks.display).toHaveBeenLastCalledWith('chapter-1.xhtml')
  session.appearance(true)
  expect(mocks.override).not.toHaveBeenCalled()
  session.destroy()
  session.destroy()
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:owned-image')
  mocks.open.mockRejectedValueOnce(new Error('engine rejected'))
  await expect(
    openEpubSession(source(), document.createElement('div'), new AbortController().signal),
  ).rejects.toThrow('engine rejected')
  expect(create).toHaveBeenCalledTimes(2)
  expect(revoke).toHaveBeenCalledTimes(2)
})

it('validates contents targets, reuses same-chapter rendering, and replaces typography on reset', async () => {
  const target = document.createElement('div')
  const session = await openEpubSession(
    new Blob([createContentsEpubFixture()]) as unknown as globalThis.Blob,
    target,
    new AbortController().signal,
    { typography: { fontSize: 20, lineSpacing: 1.8, readingWidth: 640 } },
  )
  expect(session.contentsSource).toBe('nav')
  expect(mocks.hook).toHaveBeenCalledWith(expect.any(Function))
  expect(mocks.css).toHaveBeenCalledWith(
    'papertrail-typography',
    expect.stringContaining('font-size:20px'),
  )
  const displays = mocks.display.mock.calls.length
  await session.display(0, 'section-anchor')
  expect(mocks.display).toHaveBeenCalledTimes(displays)
  await expect(session.display(0, 'missing')).rejects.toThrow('target')
  expect(mocks.display).toHaveBeenCalledTimes(displays)
  await session.display(1, 'next')
  expect(mocks.display).toHaveBeenLastCalledWith('chapter-1.xhtml')
  session.typography({ fontSize: null, lineSpacing: null, readingWidth: null })
  expect(mocks.css).toHaveBeenLastCalledWith('papertrail-typography', ':root{}')
  session.destroy()
  const calls = mocks.css.mock.calls.length
  session.typography({ fontSize: 32, lineSpacing: 2, readingWidth: 480 })
  expect(mocks.css).toHaveBeenCalledTimes(calls)
})

it('keeps the text-node offset when typography reflows the mounted view', async () => {
  const target = document.createElement('div')
  document.body.append(target)
  let container!: HTMLDivElement
  let logicalTop = 85
  const bounds = (top: number) => ({
    top,
    bottom: top + 40,
    left: 0,
    right: 400,
    width: 400,
    height: 40,
    x: 0,
    y: top,
    toJSON() {},
  })
  mocks.render.mockImplementationOnce((root: HTMLElement) => {
    Object.defineProperty(root, 'clientWidth', { value: 600 })
    Object.defineProperty(root, 'clientHeight', { value: 400 })
    container = document.createElement('div')
    container.className = 'epub-container'
    root.append(container)
    const iframe = document.createElement('iframe')
    container.append(iframe)
    iframe.contentDocument!.body.innerHTML = '<p data-reader-node="pt-3">Visible reading text</p>'
    container.getBoundingClientRect = () => bounds(0)
    iframe.getBoundingClientRect = () => bounds(-container.scrollTop)
    iframe.contentDocument!.querySelector('p')!.getBoundingClientRect = () => bounds(logicalTop)
    return {
      display: mocks.display,
      resize: mocks.resize,
      on: mocks.on,
      hooks: { content: { register: mocks.hook } },
      getContents: () => [],
      themes: {
        default: vi.fn(),
        override: mocks.override,
        add: vi.fn(),
        registerCss(name: string, css: string) {
          mocks.css(name, css)
          if (css.includes('font-size:20px')) logicalTop = 120
        },
      },
    }
  })
  try {
    const session = await openEpubSession(file(), target, new AbortController().signal)
    container.scrollTop = 100
    expect(session.position!()).toMatchObject({ node: 'pt-3', offset: -15 })
    session.typography({ fontSize: 20, lineSpacing: null, readingWidth: null })
    expect(container.scrollTop).toBe(135)
    expect(session.position!()).toMatchObject({ node: 'pt-3', offset: -15 })
    expect(mocks.resize).toHaveBeenLastCalledWith(600, 400)
    session.destroy()
  } finally {
    target.remove()
  }
})
