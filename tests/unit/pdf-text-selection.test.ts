import { afterEach, expect, it, vi } from 'vitest'
import { bindPdfTextSelection } from '../../src/features/pdf/text-selection'
import { pdfTextIndex } from '../../src/features/pdf/highlights'

const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach((dispose) => dispose())
  document.getSelection()?.removeAllRanges()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
function layer() {
  const element = document.createElement('div')
  element.className = 'textLayer'
  element.innerHTML = '<span>First line</span><br><span>Second line</span>'
  document.body.append(element)
  cleanups.push(bindPdfTextSelection(element))
  return element
}
function select(start: HTMLElement, end = start) {
  const range = document.createRange()
  range.setStart(start.firstChild!.firstChild!, 2)
  range.setEnd(end.querySelectorAll('span')[1]!.firstChild!, 6)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
  return selection
}
it('guards the whole layer while dragging through blank space without altering text offsets', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Chrome/154.0')
  const element = layer()
  const before = pdfTextIndex(element)
  element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  expect(element.classList.contains('selecting')).toBe(true)
  const selection = select(element)
  expect(element.lastElementChild?.className).toBe('endOfContent')
  expect(selection.toString()).toBe('rst lineSecond')
  expect(pdfTextIndex(element).text).toBe(before.text)
  expect(pdfTextIndex(element).positions).toEqual(before.positions)
  document.body.dispatchEvent(new Event('pointerup', { bubbles: true }))
  expect(element.classList.contains('selecting')).toBe(false)
  expect(selection.toString()).toBe('rst lineSecond')
})
it('resets all selected pages on cancellation and blur, and removes listeners on disposal', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Chrome/154.0')
  const first = layer(),
    second = layer(),
    unrelated = layer()
  first.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  select(first, second)
  expect(first.classList.contains('selecting')).toBe(true)
  expect(second.classList.contains('selecting')).toBe(true)
  expect(unrelated.classList.contains('selecting')).toBe(false)
  document.dispatchEvent(new Event('pointercancel'))
  expect(first.classList.contains('selecting')).toBe(false)
  first.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  window.dispatchEvent(new Event('blur'))
  expect(first.classList.contains('selecting')).toBe(false)
  cleanups.splice(0).forEach((dispose) => dispose())
  expect(document.querySelector('.endOfContent')).toBeNull()
  first.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  expect(first.classList.contains('selecting')).toBe(false)
  cleanups.push(bindPdfTextSelection(first))
  expect(first.querySelectorAll('.endOfContent')).toHaveLength(1)
})
it('places the compatibility guard beside the moving boundary without changing selected text', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Chrome/147.0')
  const element = layer()
  const second = element.querySelectorAll('span')[1]!
  const selection = select(element)
  expect(second.nextElementSibling?.className).toBe('endOfContent')
  expect(selection.toString()).toBe('rst lineSecond')
  expect(pdfTextIndex(element).text).toBe('First line Second line')
  document.dispatchEvent(new Event('pointerup'))
  expect(element.querySelector<HTMLElement>('.endOfContent')!.style.userSelect).toBe('')
})

function geometryLayer(top = 0) {
  const element = layer()
  element.querySelectorAll('span')[0]!.textContent = 'ABC'
  element.querySelectorAll('span')[1]!.textContent = 'DEF'
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 100,
    top,
    bottom: top + 100,
    width: 100,
    height: 100,
  } as DOMRect)
  return element
}
function pointer(target: EventTarget, type: string, x: number, y: number, id = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerType: 'mouse', pointerId: id, button: 0, clientX: x, clientY: y })
  target.dispatchEvent(event)
}
function mockGeometry() {
  if (!Range.prototype.getClientRects)
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    })
  vi.spyOn(Range.prototype, 'getClientRects').mockImplementation(function (this: Range) {
    const node = this.startContainer as Text
    if (node.nodeType !== Node.TEXT_NODE) return [] as unknown as DOMRectList
    const span = node.parentElement!,
      layer = span.closest<HTMLElement>('.textLayer')!
    const top = layer.getBoundingClientRect().top + (span === layer.querySelector('span') ? 20 : 40)
    const left = 20 + this.startOffset * 10,
      right = 20 + this.endOffset * 10
    if (layer.dataset.mainRotation === '90')
      return [
        {
          left: 100 - top - 10,
          right: 100 - top,
          top: left,
          bottom: right,
          width: 10,
          height: right - left,
        },
      ] as unknown as DOMRectList
    return [
      { left, right, top, bottom: top + 10, width: right - left, height: 10 },
    ] as unknown as DOMRectList
  })
}
it('anchors margin-start drags to the intended line and preserves selection outside the page', () => {
  mockGeometry()
  const element = geometryLayer()
  pointer(element, 'pointerdown', 0, 25)
  expect(document.getSelection()!.anchorOffset).toBe(0)
  pointer(document.body, 'pointerup', 500, 45)
  expect(document.getSelection()!.toString()).toBe('ABCDEF')
  expect(document.getSelection()!.anchorNode).toBe(element.querySelector('span')!.firstChild)
  expect(document.getSelection()!.anchorOffset).toBe(0)
  expect(document.getSelection()!.focusOffset).toBe(3)
})
it('keeps a fixed right-margin anchor for backward/outside-page drags and re-entry', () => {
  mockGeometry()
  const element = geometryLayer()
  let frame: FrameRequestCallback | undefined
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frame = callback
    return 1
  })
  pointer(element, 'pointerdown', 100, 45)
  expect(document.getSelection()!.anchorOffset).toBe(3)
  const anchor = document.getSelection()!.anchorNode
  pointer(document.body, 'pointermove', -500, 25)
  frame!(0)
  expect(document.getSelection()!.anchorNode).toBe(anchor)
  expect(document.getSelection()!.toString()).toBe('ABCDEF')
  pointer(element, 'pointerup', 30, 25)
  expect(document.getSelection()!.toString()).toBe('BCDEF')
  expect(document.getSelection()!.anchorNode).toBe(anchor)
  expect(document.getSelection()!.anchorOffset).toBe(3)
})
it('extends across mounted pages, ignores other pointers and releases drag state on cancel', () => {
  mockGeometry()
  const first = geometryLayer(),
    second = geometryLayer(120)
  pointer(first, 'pointerdown', 30, 25)
  pointer(document.body, 'pointerup', 500, 165, 2)
  // A different pointer must not terminate the active mouse drag.
  pointer(second, 'pointerup', 40, 165)
  expect(document.getSelection()!.anchorNode).toBe(first.querySelector('span')!.firstChild)
  expect(document.getSelection()!.focusNode).toBe(second.querySelectorAll('span')[1]!.firstChild)
  expect(document.getSelection()!.focusOffset).toBe(2)
  pointer(first, 'pointerdown', 30, 25)
  document.dispatchEvent(new Event('pointercancel'))
  pointer(second, 'pointerup', 50, 165)
  expect(document.getSelection()!.isCollapsed).toBe(true)
})

it('resolves margin and outside drags along the text axis on rotated pages', () => {
  mockGeometry()
  const element = geometryLayer()
  element.dataset.mainRotation = '90'
  pointer(element, 'pointerdown', 75, 0)
  pointer(document.body, 'pointerup', 55, 500)
  expect(document.getSelection()!.toString()).toBe('ABCDEF')
  expect(document.getSelection()!.anchorOffset).toBe(0)
  expect(document.getSelection()!.focusOffset).toBe(3)
})
it('leaves double-click word selection native instead of extending the mouse drag', () => {
  mockGeometry()
  const element = geometryLayer()
  pointer(element, 'pointerdown', 20, 25)
  const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 })
  element.dispatchEvent(down)
  expect(down.defaultPrevented).toBe(false)
  const range = document.createRange()
  range.selectNodeContents(element.querySelector('span')!)
  document.getSelection()!.removeAllRanges()
  document.getSelection()!.addRange(range)
  pointer(document.body, 'pointerup', 500, 45)
  expect(document.getSelection()!.toString()).toBe('ABC')
})
