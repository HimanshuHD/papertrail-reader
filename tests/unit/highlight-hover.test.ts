import { expect, it, vi } from 'vitest'
import { bindHighlightHover } from '../../src/features/annotations/highlight-hover'
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
  expect(hover).toHaveBeenLastCalledWith('saved')
  expect(target.style.cursor).toBe('pointer')
  expect(target.title).toBe('Show highlighted text')
  target.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: 30, bubbles: true }))
  expect(target.style.cursor).toBe('text')
  expect(target.title).toBe('Original')
  target.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 30, bubbles: true }))
  dispose()
  expect(hover).toHaveBeenLastCalledWith(null)
  expect(target.style.cursor).toBe('text')
  expect(target.title).toBe('Original')
})
