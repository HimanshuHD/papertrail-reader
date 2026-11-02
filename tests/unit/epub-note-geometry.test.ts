import { afterEach, expect, it, vi } from 'vitest'
import { EpubNoteGeometry, observeEpubNoteLayout } from '../../src/features/epub/note-geometry'

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
const rect = (top: number, height = 10) => new DOMRect(0, top, 40, height)
const rectList = (...rectangles: DOMRect[]) =>
  Object.assign(rectangles, { item: (index: number) => rectangles[index] ?? null })
it('preserves original first-visible rectangle and annotation order while avoiding repeated range reads', () => {
  const cache = new EpubNoteGeometry()
  const first = vi.fn(() => rectList(rect(300), rect(100), rect(200)))
  const second = vi.fn(() => rectList(rect(105)))
  const source = vi.fn(() => [
    { id: 'first', note: 'One', range: { getClientRects: first } },
    { id: 'second', note: 'Two', range: { getClientRects: second } },
  ])
  expect(cache.visible(source, 0, 90, 250)).toEqual([
    { id: 'first', note: 'One', top: 100 },
    { id: 'second', note: 'Two', top: 105 },
  ])
  expect(cache.visible(source, 50, 190, 400)).toEqual([{ id: 'first', note: 'One', top: 250 }])
  expect(source).toHaveBeenCalledOnce()
  expect(first).toHaveBeenCalledOnce()
  expect(second).toHaveBeenCalledOnce()
  cache.invalidate()
  cache.visible(source, 0, 0, 500)
  expect(first).toHaveBeenCalledTimes(2)
})
it('matches the uncached visible-rectangle rule for overlapping, empty and distant ranges', () => {
  const all = [[rect(0, 1000), rect(30)], [rect(-20), rect(10, 0)], [rect(2000)], []]
  const source = all.map((rectangles, index) => ({
    id: String(index),
    note: 'note',
    range: { getClientRects: () => rectList(...rectangles) },
  }))
  const cache = new EpubNoteGeometry()
  for (let top = -50; top < 2200; top += 37) {
    const bottom = top + 100
    const expected = all.flatMap((rectangles, i) => {
      const match = rectangles.find(
        (r) => r.width > 0 && r.height > 0 && r.bottom > top && r.top < bottom,
      )
      return match ? [{ id: String(i), note: 'note', top: match.top }] : []
    })
    expect(cache.visible(() => source, 0, top, bottom)).toEqual(expected)
  }
  cache.invalidate()
  expect(cache.visible(() => [], 0, 0, 100)).toEqual([])
})
it('uses the original fresh lookup for animations and rebuilds afterward', () => {
  const cache = new EpubNoteGeometry()
  let top = 10
  const source = vi.fn(() => [
    { id: 'moving', note: 'Animated', range: { getClientRects: () => rectList(rect(top)) } },
  ])
  expect(cache.visible(source, 0, 0, 100)[0]!.top).toBe(10)
  top = 30
  expect(cache.visible(source, 0, 0, 100, true)[0]!.top).toBe(30)
  top = 40
  expect(cache.visible(source, 0, 0, 100)[0]!.top).toBe(40)
  expect(source).toHaveBeenCalledTimes(3)
})
it('invalidates author layout and font/image/nested-scroll events, ignores paint-only reader styles and tears down', async () => {
  const frame = document.createElement('iframe')
  document.body.append(frame)
  const doc = frame.contentDocument!,
    fonts = new EventTarget()
  Object.defineProperty(doc, 'fonts', { configurable: true, value: fonts })
  const changed = vi.fn(),
    binding = observeEpubNoteLayout(doc, changed)
  const own = doc.createElement('style')
  own.dataset.papertrailHighlights = 'true'
  own.textContent = '::highlight(x){background:yellow}'
  doc.head.append(own)
  await Promise.resolve()
  await Promise.resolve()
  expect(changed).not.toHaveBeenCalled()
  const paragraph = doc.createElement('p')
  doc.body.append(paragraph)
  await Promise.resolve()
  changed.mockClear()
  paragraph.style.marginTop = '20px'
  await Promise.resolve()
  expect(changed).toHaveBeenCalled()
  for (const [target, event] of [
    [fonts, 'loadingdone'],
    [fonts, 'loadingerror'],
    [doc, 'load'],
    [doc, 'error'],
    [paragraph, 'scroll'],
    [doc.defaultView!, 'resize'],
  ] as const) {
    changed.mockClear()
    target.dispatchEvent(new Event(event, { bubbles: true }))
    expect(changed).toHaveBeenCalled()
  }
  binding.dispose()
  binding.dispose()
  changed.mockClear()
  paragraph.style.marginTop = '50px'
  fonts.dispatchEvent(new Event('loadingdone'))
  paragraph.dispatchEvent(new Event('scroll', { bubbles: true }))
  await Promise.resolve()
  expect(changed).not.toHaveBeenCalled()
})
