import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { bindHighlightHover } from '../../src/features/annotations/highlight-hover'
let callbacks: FrameRequestCallback[] = []
function frame() {
  callbacks.splice(0).forEach((callback) => callback(0))
}
beforeEach(() => {
  callbacks = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    callbacks.push(callback),
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())
it('shows the hint only over verified ranges and restores authored cursor/title on leave and disposal', () => {
  const root = document.createElement('div')
  root.innerHTML = '<span title="Original" style="cursor:text">Saved text</span>'
  const target = root.firstElementChild as HTMLElement
  const hover = vi.fn()
  const dispose = bindHighlightHover(
    root,
    () => [{ id: 'saved', left: 10, top: 20, right: 80, bottom: 40 }],
    hover,
  )
  target.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 30, bubbles: true }))
  frame()
  expect(hover).toHaveBeenLastCalledWith('saved')
  expect(target.style.cursor).toBe('pointer')
  expect(target.title).toBe('Show highlighted text')
  target.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: 30, bubbles: true }))
  frame()
  expect(target.style.cursor).toBe('text')
  expect(target.title).toBe('Original')
  target.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 30, bubbles: true }))
  dispose()
  expect(hover).toHaveBeenLastCalledWith(null)
  expect(target.style.cursor).toBe('text')
  expect(target.title).toBe('Original')
})

function fixture() {
  const root = document.createElement('div')
  root.innerHTML = '<span>First</span><span>Second</span>'
  const first = root.children[0] as HTMLElement
  const second = root.children[1] as HTMLElement
  const rectangles = vi.fn(() => [
    { id: 'first', left: 0, right: 50, top: 0, bottom: 10 },
    { id: 'second', left: 0, right: 50, top: 20, bottom: 30 },
    { id: 'overlap', left: 10, right: 60, top: 20, bottom: 30 },
  ])
  const hover = vi.fn()
  let active = true
  const dispose = bindHighlightHover(root, rectangles, hover, () => active)
  const move = (target = first, x = 5, y = 5) =>
    target.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }))
  return {
    root,
    first,
    second,
    rectangles,
    hover,
    dispose,
    move,
    suspend() {
      active = false
      dispose.clear()
    },
  }
}

it('coalesces a burst and uses the latest target and coordinates with ordered multiline overlap hits', () => {
  const f = fixture()
  for (let i = 0; i < 50; i++) f.move()
  f.move(f.second, 20, 25)
  expect(f.rectangles).not.toHaveBeenCalled()
  expect(callbacks).toHaveLength(1)
  frame()
  expect(f.rectangles).toHaveBeenCalledTimes(1)
  expect(f.hover).toHaveBeenLastCalledWith('second')
  expect(f.first.style.cursor).toBe('')
  expect(f.second.style.cursor).toBe('pointer')
  f.dispose()
})

it('reads fresh geometry and highlight identity each frame after layout changes and edits', () => {
  const f = fixture()
  f.move()
  frame()
  expect(f.hover).toHaveBeenLastCalledWith('first')
  f.rectangles.mockReturnValue([{ id: 'edited', left: 100, right: 120, top: 50, bottom: 60 }])
  f.move(f.first, 110, 55)
  frame()
  expect(f.hover).toHaveBeenLastCalledWith('edited')
  f.rectangles.mockReturnValue([])
  f.move(f.first, 110, 55)
  frame()
  expect(f.hover).toHaveBeenLastCalledWith(null)
  expect(f.first.style.cursor).toBe('')
  f.dispose()
})

it.each(['pointerleave', 'pointercancel', 'suspend', 'dispose'])(
  '%s rejects even late cancelled frames and restores hints',
  (reason) => {
    const f = fixture()
    f.move()
    frame()
    f.move()
    if (reason === 'suspend') f.suspend()
    else if (reason === 'dispose') {
      f.dispose()
      f.dispose()
    } else f.root.dispatchEvent(new Event(reason))
    const count = f.rectangles.mock.calls.length
    frame() // mock intentionally delivers cancelled work
    expect(f.rectangles).toHaveBeenCalledTimes(count)
    expect(f.hover).toHaveBeenLastCalledWith(null)
    expect(f.first.style.cursor).toBe('')
    if (reason !== 'dispose' && reason !== 'suspend') {
      f.move()
      frame()
      expect(f.hover).toHaveBeenLastCalledWith('first')
    } else {
      f.move()
      frame()
      expect(f.rectangles).toHaveBeenCalledTimes(count)
    }
    f.dispose()
  },
)

it('ignores removed targets and preserves important authored cursor values', () => {
  const f = fixture()
  f.first.style.setProperty('cursor', 'crosshair', 'important')
  f.move()
  frame()
  f.dispose.clear()
  expect(f.first.style.getPropertyValue('cursor')).toBe('crosshair')
  expect(f.first.style.getPropertyPriority('cursor')).toBe('important')
  f.move()
  f.first.remove()
  frame()
  expect(f.hover).toHaveBeenLastCalledWith(null)
  expect(f.rectangles).toHaveBeenCalledTimes(1)
  f.dispose()
})

it('matches later lines of one highlight and preserves the first match for overlaps', () => {
  const f = fixture()
  f.rectangles.mockReturnValue([
    { id: 'multiline', left: 0, right: 50, top: 0, bottom: 10 },
    { id: 'multiline', left: 0, right: 50, top: 20, bottom: 30 },
    { id: 'overlap', left: 10, right: 60, top: 20, bottom: 30 },
  ])
  f.move(f.second, 20, 25)
  frame()
  expect(f.hover).toHaveBeenLastCalledWith('multiline')
  f.dispose()
})
