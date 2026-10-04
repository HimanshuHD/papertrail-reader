import { expect, it, vi } from 'vitest'
import type Rendition from 'epubjs/types/rendition'
import { keepScrolledChapterMounted } from '../../src/features/epub/scroll-layout'

it('resizes the existing chapter using width after the scrollbar gutter without clearing views', () => {
  const root = document.createElement('div')
  const iframe = document.createElement('iframe')
  root.append(iframe)
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { get: () => 304 })
  Object.defineProperty(container, 'clientHeight', { get: () => 500 })
  const original = vi.fn()
  const size = vi.fn()
  const view = { size: vi.fn() }
  const layout = { calculate: vi.fn() }
  const manager = {
    container,
    stage: { settings: { width: 900, height: 500 }, size },
    layout,
    viewSettings: { width: 900, height: 500 },
    views: { forEach: (fn: (v: typeof view) => void) => fn(view) },
    setLayout: vi.fn(),
    bounds: () => container.getBoundingClientRect(),
    _bounds: container.getBoundingClientRect(),
    resize: original,
  }
  const restore = keepScrolledChapterMounted({ manager } as unknown as Rendition, root)
  manager.resize(320, 500)
  expect(original).not.toHaveBeenCalled()
  expect(root.firstChild).toBe(iframe)
  expect(size).toHaveBeenCalledWith(320, 500)
  expect(view.size).toHaveBeenCalledWith(304, 500)
  expect(layout.calculate).toHaveBeenCalledWith(304, 500)
  expect(manager.stage.settings.width).toBe(320)
  expect(manager.container.style.overflowX).toBe('hidden')
  expect(manager.container.style.getPropertyPriority('overflow-x')).toBe('important')
  restore()
  expect(manager.resize).toBe(original)
})
