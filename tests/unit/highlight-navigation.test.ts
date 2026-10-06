import { afterEach, expect, it, vi } from 'vitest'
import { scrollHighlightRange } from '../../src/features/annotations/highlight-navigation'

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
function viewport() {
  const pane = document.createElement('div')
  document.body.append(pane)
  Object.defineProperties(pane, {
    clientHeight: { value: 400 },
    scrollHeight: { value: 2000 },
    clientTop: { value: 2 },
  })
  vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect)
  pane.scrollTop = 300
  return pane
}
function rangeFor(element: Element, tops = [550, 480]) {
  const range = element.ownerDocument.createRange()
  range.selectNodeContents(element)
  Object.defineProperty(range, 'getClientRects', {
    value: () => tops.map((top) => ({ top, width: 80, height: 20 })),
  })
  return range
}
it('aligns the first PDF highlight line with a 24px inset, including pane borders', () => {
  const pane = viewport()
  pane.innerHTML = '<p>Highlight text</p>'
  expect(scrollHighlightRange(pane, rangeFor(pane.firstElementChild!))).toBe(true)
  expect(pane.scrollTop).toBe(654)
})
it('maps EPUB frame coordinates into its scroll pane and clamps document edges', () => {
  const pane = viewport()
  const frame = document.createElement('iframe')
  pane.append(frame)
  frame.contentDocument!.body.innerHTML = '<p>EPUB text</p>'
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ top: -150 } as DOMRect)
  const range = rangeFor(frame.contentDocument!.querySelector('p')!, [800, 830])
  expect(scrollHighlightRange(pane, range, frame)).toBe(true)
  expect(pane.scrollTop).toBe(824)
  const start = rangeFor(frame.contentDocument!.querySelector('p')!, [-900])
  expect(scrollHighlightRange(pane, start, frame)).toBe(true)
  expect(pane.scrollTop).toBe(0)
  const end = rangeFor(frame.contentDocument!.querySelector('p')!, [5000])
  expect(scrollHighlightRange(pane, end, frame)).toBe(true)
  expect(pane.scrollTop).toBe(1600)
})
it('rejects stale/external ranges and ranges without visible geometry', () => {
  const pane = viewport()
  const outside = document.createElement('p')
  outside.textContent = 'Other reader'
  document.body.append(outside)
  expect(scrollHighlightRange(pane, rangeFor(outside))).toBe(false)
  pane.innerHTML = '<p>Current reader</p>'
  expect(scrollHighlightRange(pane, rangeFor(pane.firstElementChild!, []))).toBe(false)
  expect(pane.scrollTop).toBe(300)
  const frame = document.createElement('iframe')
  pane.append(frame)
  expect(scrollHighlightRange(pane, rangeFor(outside), frame)).toBe(false)
})
