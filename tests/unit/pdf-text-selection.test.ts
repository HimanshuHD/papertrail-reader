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
