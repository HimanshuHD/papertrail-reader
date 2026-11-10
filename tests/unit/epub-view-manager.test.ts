import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { Rendition } from 'epubjs'
import {
  managedEpubViewManager,
  type EpubManagerConstructor,
} from '../../src/features/epub/view-manager'

const EngineManager = Rendition.prototype.requireManager('default') as EpubManagerConstructor

beforeEach(() => vi.spyOn(window, 'addEventListener'))
afterEach(() => {
  vi.useRealTimers()
  for (const [name, callback] of vi.mocked(window.addEventListener).mock.calls) {
    if (['unload', 'orientationchange', 'resize'].includes(name) && callback)
      window.removeEventListener(name, callback)
  }
  vi.restoreAllMocks()
})

it('keeps live scroll delivery but coalesces costly engine location reports to the latest settled scroll', () => {
  vi.useFakeTimers()
  const emit = vi.spyOn(EngineManager.prototype, 'emit')
  const Manager = managedEpubViewManager(EngineManager)
  const manager = new Manager({ settings: {} })
  manager.container = document.createElement('div')
  manager.addEventListeners()
  for (let index = 0; index < 12; index++) {
    manager.container.scrollTop = index * 100
    manager.container.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(35)
  }
  expect(emit.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(12)
  expect(emit.mock.calls.filter(([type]) => type === 'scrolled')).toHaveLength(0)
  vi.advanceTimersByTime(150)
  expect(emit.mock.calls.filter(([type]) => type === 'scrolled')).toEqual([
    ['scrolled', { top: 1100, left: 0 }],
  ])
  manager.removeEventListeners()
  expect(vi.getTimerCount()).toBe(0)
})

it('cancels both engine and adapter trailing reports on removal and rejects a stale bound callback', () => {
  vi.useFakeTimers()
  const emit = vi.spyOn(EngineManager.prototype, 'emit')
  const Manager = managedEpubViewManager(EngineManager)
  const manager = new Manager({ settings: {} })
  manager.container = document.createElement('div')
  manager.addEventListeners()
  const stale = manager._onScroll!
  manager.container.dispatchEvent(new Event('scroll'))
  vi.advanceTimersByTime(25)
  manager.removeEventListeners()
  stale(new Event('scroll'))
  vi.advanceTimersByTime(500)
  expect(emit.mock.calls.filter(([type]) => type === 'scrolled')).toHaveLength(0)
  expect(vi.getTimerCount()).toBe(0)
  manager.addEventListeners()
  manager.container.dispatchEvent(new Event('scroll'))
  manager.removeEventListeners()
  vi.advanceTimersByTime(500)
  expect(emit.mock.calls.filter(([type]) => type === 'scrolled')).toHaveLength(0)
})

for (const fullsize of [false, true]) {
  it(`removes the engine window handler and original scroll target (fullsize=${fullsize})`, () => {
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const Manager = managedEpubViewManager(EngineManager)
    for (let cycle = 0; cycle < 10; cycle++) {
      const manager = new Manager({ settings: { fullsize } })
      manager.container = document.createElement('div')
      manager.addEventListeners()
      const unload = added.mock.calls.filter(([name]) => name === 'unload').at(-1)![1]
      const scrollTarget = fullsize ? window : manager.container
      const removeScroll = vi.spyOn(scrollTarget, 'removeEventListener')
      const scroll = manager._onScroll
      manager.settings.fullsize = !fullsize
      manager.removeEventListeners()
      expect(removeScroll).toHaveBeenCalledWith('scroll', scroll)
      expect(removed).toHaveBeenCalledWith('unload', unload)
      expect(manager._onScroll).toBeUndefined()
      // Never leave test handlers alive, even when running against the old engine.
      window.removeEventListener('unload', unload!)
    }
  })
}

it('does not duplicate bindings and allows removal and rebinding', () => {
  const added = vi.spyOn(window, 'addEventListener')
  const Manager = managedEpubViewManager(EngineManager)
  const manager = new Manager({ settings: {} })
  manager.container = document.createElement('div')
  const scroll = vi.spyOn(manager.container, 'addEventListener')
  manager.addEventListeners()
  manager.addEventListeners()
  expect(added.mock.calls.filter(([name]) => name === 'unload')).toHaveLength(1)
  expect(scroll).toHaveBeenCalledTimes(1)
  manager.removeEventListeners()
  manager.removeEventListeners()
  manager.addEventListeners()
  expect(added.mock.calls.filter(([name]) => name === 'unload')).toHaveLength(2)
  manager.removeEventListeners()
})

it('removes window ownership before engine teardown, even when teardown throws', () => {
  const remove = vi.spyOn(window, 'removeEventListener')
  const failure = new Error('engine cleanup failed')
  const orientation = vi.fn()
  const resize = Object.assign(vi.fn(), { cancel: vi.fn() })
  const destroy = vi.spyOn(EngineManager.prototype, 'destroy').mockImplementation(() => {
    expect(remove).toHaveBeenCalledWith('unload', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('orientationchange', orientation)
    expect(remove).toHaveBeenCalledWith('resize', resize)
    expect(resize.cancel).toHaveBeenCalledOnce()
    throw failure
  })
  const Manager = managedEpubViewManager(EngineManager)
  const manager = new Manager({ settings: {} })
  manager.container = document.createElement('div')
  manager.stage = { orientationChangeFunc: orientation, resizeFunc: resize }
  window.addEventListener('orientationchange', orientation)
  window.addEventListener('resize', resize)
  manager.addEventListeners()
  expect(() => manager.destroy()).toThrow(failure)
  manager.destroy()
  expect(destroy).toHaveBeenCalledTimes(1)
})

it('preserves scroll delivery while live and unload teardown without double disposal', () => {
  const destroy = vi.spyOn(EngineManager.prototype, 'destroy').mockImplementation(() => {})
  const Manager = managedEpubViewManager(EngineManager)
  const manager = new Manager({ settings: {} })
  manager.container = document.createElement('div')
  const scroll = vi.spyOn(manager, 'onScroll').mockImplementation(() => {})
  manager.addEventListeners()
  manager.container.dispatchEvent(new Event('scroll'))
  expect(scroll).toHaveBeenCalledTimes(1)
  window.dispatchEvent(new Event('unload'))
  manager.container.dispatchEvent(new Event('scroll'))
  manager.destroy()
  expect(scroll).toHaveBeenCalledTimes(1)
  expect(destroy).toHaveBeenCalledTimes(1)
})

it('releases real engine stage orientation handlers across repeated render and destroy', () => {
  const added = vi.mocked(window.addEventListener)
  const removed = vi.spyOn(window, 'removeEventListener')
  const Manager = managedEpubViewManager(EngineManager)
  const root = document.createElement('div')
  document.body.append(root)
  try {
    for (let cycle = 0; cycle < 10; cycle++) {
      const manager = new Manager({
        settings: { width: 600, height: 400 },
      }) as InstanceType<EpubManagerConstructor> & {
        render(root: HTMLElement, size: { width: number; height: number }): void
      }
      manager.render(root, { width: 600, height: 400 })
      const orientation = added.mock.calls
        .filter(([name]) => name === 'orientationchange')
        .at(-1)![1]
      manager.destroy()
      expect(removed).toHaveBeenCalledWith('orientationchange', orientation)
      expect(root.children).toHaveLength(0)
    }
  } finally {
    root.remove()
  }
})
