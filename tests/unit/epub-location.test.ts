import { afterEach, expect, it, vi } from 'vitest'
import { EpubCFI } from 'epubjs'
import {
  captureLocation,
  restoreLocation,
  normalizeLocation,
  type CfiBridge,
} from '../../src/features/epub/location'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
function scene(text = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  const root = document.createElement('div')
  const container = document.createElement('div')
  container.className = 'epub-container'
  const iframe = document.createElement('iframe')
  container.append(iframe)
  root.append(container)
  document.body.append(root)
  const doc = iframe.contentDocument!
  doc.body.innerHTML = `<p data-reader-node="pt-3">${text}</p>`
  const node = doc.querySelector('p')!.firstChild as Text
  let columns = 10
  let lineHeight = 20
  const rect = (top: number, height = 20) => new DOMRect(0, top, 200, height)
  Object.defineProperty(container, 'scrollHeight', { get: () => 2000 })
  Object.defineProperty(container, 'clientHeight', { get: () => 100 })
  container.getBoundingClientRect = () => rect(0, 100)
  iframe.getBoundingClientRect = () => rect(-container.scrollTop, 2000)
  doc.querySelector('p')!.getBoundingClientRect = () =>
    rect(0, Math.ceil(text.length / columns) * lineHeight)
  Object.defineProperty(doc.defaultView!.Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function (this: Range) {
      const top = Math.floor(this.startOffset / columns) * lineHeight
      const bottom =
        Math.floor(Math.max(this.startOffset, this.endOffset - 1) / columns) * lineHeight +
        lineHeight
      return rect(top, bottom - top)
    },
  })
  const bridge: CfiBridge = {
    cfiBase: '/6/2[chapter-0]',
    cfiFromRange: (r) => new EpubCFI(r, '/6/2[chapter-0]').toString(),
    range: (cfi) => new EpubCFI(cfi).toRange(doc),
  }
  return {
    root,
    container,
    doc,
    node,
    bridge,
    reflow: (width: number, height: number) => {
      columns = width
      lineHeight = height
    },
  }
}
it('captures a real CFI and visible character, then retains its pixel offset across reflow', () => {
  const s = scene()
  s.container.scrollTop = 45
  const saved = captureLocation(s.root, 0, 'formatted', s.bridge)!
  expect(saved.kind).toBe('text')
  expect(saved.character).toBe(20)
  expect(saved.offset).toBe(-5)
  expect(saved.cfi).toContain('epubcfi(/6/2[chapter-0]!')
  s.reflow(5, 30)
  expect(restoreLocation(s.root, saved, 'formatted', s.bridge)).toBe(true)
  expect(s.container.scrollTop).toBe(125)
  expect(captureLocation(s.root, 0, 'formatted', s.bridge)?.character).toBe(20)
})
it('uses stable source text when mode CFIs differ, excluding image alternate text', () => {
  const s = scene()
  s.doc
    .querySelector('p')!
    .insertAdjacentHTML(
      'afterbegin',
      '<span data-reader-image="" data-reader-node="pt-2">Image description</span>',
    )
  s.container.scrollTop = 45
  const saved = captureLocation(s.root, 0, 'formatted', s.bridge)!
  expect(saved.character).toBe(20)
  expect(saved.quote).toBe('uvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
  s.reflow(5, 24)
  const wrong = {
    ...s.bridge,
    range: vi.fn(() => {
      throw new Error('wrong DOM')
    }),
  }
  expect(restoreLocation(s.root, saved, 'text', wrong)).toBe(true)
  expect(wrong.range).not.toHaveBeenCalled()
  expect(s.container.scrollTop).toBe(96)
})
it('rejects bad locations and wrong text anchors without moving scroll', () => {
  const s = scene()
  s.container.scrollTop = 45
  const saved = captureLocation(s.root, 0, 'formatted')!
  for (const value of [
    { ...saved, chapter: 2 },
    { ...saved, offset: NaN },
    { ...saved, ratio: 2 },
    { ...saved, node: 'x"] img' },
    { ...saved, character: -1 },
    { ...saved, version: 2 },
  ])
    expect(normalizeLocation(value, 2)).toBeUndefined()
  expect(normalizeLocation({ ...saved, cfi: 'https://evil.invalid' }, 2)?.cfi).toBeNull()
  expect(restoreLocation(s.root, { ...saved, quote: 'different text' }, 'formatted')).toBe(false)
  expect(restoreLocation(s.root, { ...saved, character: 999, quote: '' }, 'formatted')).toBe(false)
  expect(s.container.scrollTop).toBe(45)
})
it('keeps end-of-chapter at the new bottom and clears horizontal displacement', () => {
  const s = scene('x'.repeat(1000))
  s.container.scrollTop = 1900
  s.container.scrollLeft = 30
  const saved = captureLocation(s.root, 0, 'formatted')!
  expect(saved.atEnd).toBe(true)
  s.reflow(5, 30)
  expect(restoreLocation(s.root, saved, 'text')).toBe(true)
  expect(s.container.scrollTop).toBe(1900)
  expect(s.container.scrollLeft).toBe(0)
})
it('captures element-only images and restores the surviving anchor in text-only mode', () => {
  const s = scene()
  s.doc.body.innerHTML = '<img data-reader-image="" data-reader-node="pt-3" />'
  s.doc.querySelector('img')!.getBoundingClientRect = () => new DOMRect(0, 0, 200, 400)
  s.container.scrollTop = 120
  const saved = captureLocation(s.root, 0, 'formatted')!
  expect(saved.kind).toBe('element')
  s.doc.body.innerHTML = '<span data-reader-image="" data-reader-node="pt-3">Illustration</span>'
  expect(restoreLocation(s.root, saved, 'text')).toBe(true)
  expect(s.container.scrollTop).toBe(0)
})

it('uses RTL caret coordinates and rejects a CFI for a different chapter base', () => {
  const s = scene()
  s.doc.body.dir = 'rtl'
  s.container.scrollTop = 45
  const caret = vi.fn(() => {
    const r = s.doc.createRange()
    r.setStart(s.node, 20)
    return r
  })
  Object.defineProperty(s.doc, 'caretRangeFromPoint', { configurable: true, value: caret })
  const saved = captureLocation(s.root, 0, 'formatted', s.bridge)!
  expect(caret).toHaveBeenCalledWith(168, 53)
  const bridge = { ...s.bridge, range: vi.fn(s.bridge.range) }
  expect(
    restoreLocation(
      s.root,
      { ...saved, cfi: 'epubcfi(/6/4[other]!/4/2/1:20)' },
      'formatted',
      bridge,
    ),
  ).toBe(true)
  expect(bridge.range).not.toHaveBeenCalled()
})

it('keeps the anchored passage visible when a mode change shrinks a partially visible line', () => {
  const s = scene('x'.repeat(1000))
  s.reflow(10, 80)
  s.container.scrollTop = 55
  const saved = captureLocation(s.root, 0, 'formatted')!
  expect(saved.offset).toBe(-55)
  s.reflow(20, 20)
  expect(restoreLocation(s.root, saved, 'text')).toBe(true)
  expect(s.container.scrollTop).toBe(0)
  expect(captureLocation(s.root, 0, 'text')?.character).toBe(saved.character)
})

it('uses caretPositionFromPoint when the range caret API is unavailable or unhelpful', () => {
  const s = scene()
  s.container.scrollTop = 45
  Object.defineProperty(s.doc, 'caretRangeFromPoint', { configurable: true, value: () => null })
  const caret = vi.fn(() => ({ offsetNode: s.node, offset: 20 }))
  Object.defineProperty(s.doc, 'caretPositionFromPoint', { configurable: true, value: caret })
  const saved = captureLocation(s.root, 0, 'formatted')!
  expect(saved.character).toBe(20)
  expect(saved.offset).toBe(-5)
  expect(caret).toHaveBeenCalledWith(32, 53)
})

it('narrows forced fallback to point-hit text and reads fresh geometry after reflow', () => {
  const s = scene()
  s.container.scrollTop = 45
  Object.defineProperty(s.doc, 'caretRangeFromPoint', { configurable: true, value: undefined })
  Object.defineProperty(s.doc, 'caretPositionFromPoint', { configurable: true, value: undefined })
  const element = s.doc.querySelector('p')!
  Object.defineProperty(s.doc, 'elementsFromPoint', {
    configurable: true,
    value: () => [element, s.doc.body],
  })
  const walk = vi.spyOn(s.doc, 'createTreeWalker')
  const saved = captureLocation(s.root, 0, 'formatted')!
  expect(saved.character).toBe(20)
  expect(walk.mock.calls.every(([root]) => root === element)).toBe(true)
  s.reflow(5, 30)
  expect(restoreLocation(s.root, saved, 'formatted')).toBe(true)
  expect(captureLocation(s.root, 0, 'formatted')?.character).toBe(20)
})

it('streams the bounded fallback and stops when it finds the visible text', () => {
  const s = scene()
  s.doc
    .querySelector('p')!
    .insertAdjacentHTML('afterend', '<p data-reader-node="pt-9">Later text</p>')
  const original = s.doc.createTreeWalker.bind(s.doc)
  const visits = vi.fn()
  vi.spyOn(s.doc, 'createTreeWalker').mockImplementation((...args) => {
    const walker = original(...args)
    const next = walker.nextNode.bind(walker)
    walker.nextNode = () => {
      const node = next()
      if (node) visits(node)
      return node
    }
    return walker
  })
  const saved = captureLocation(s.root, 0, 'text')!
  expect(saved.node).toBe('pt-3')
  expect(visits.mock.calls.every(([node]) => node === s.node)).toBe(true)
})

it('rejects a foreign caret and falls back safely', () => {
  const s = scene()
  const other = document.createTextNode('Foreign')
  Object.defineProperty(s.doc, 'caretPositionFromPoint', {
    configurable: true,
    value: () => ({ offsetNode: other, offset: 0 }),
  })
  expect(captureLocation(s.root, 0, 'text')?.node).toBe('pt-3')
})

it('probes past paragraph margins before falling back to the full chapter', () => {
  const s = scene()
  s.container.scrollTop = 45
  const element = s.doc.querySelector('p')!
  const hit = vi.fn((_x: number, y: number) => (y < 90 ? [s.doc.body] : [element, s.doc.body]))
  Object.defineProperty(s.doc, 'elementsFromPoint', { configurable: true, value: hit })
  const walk = vi.spyOn(s.doc, 'createTreeWalker')
  expect(captureLocation(s.root, 0, 'formatted')?.character).toBe(20)
  expect(hit.mock.calls.map(([, y]) => y)).toEqual([53, 69, 93])
  expect(walk.mock.calls.every(([root]) => root === element)).toBe(true)
})

it('retains UTF-16 character offsets when the alternate caret API lands after an emoji', () => {
  const s = scene('😀A visible passage')
  Object.defineProperty(s.doc, 'caretPositionFromPoint', {
    configurable: true,
    value: () => ({ offsetNode: s.node, offset: 2 }),
  })
  const saved = captureLocation(s.root, 0, 'formatted')!
  expect(saved.character).toBe(2)
  expect(saved.quote).toBe('A visible passage')
  expect(restoreLocation(s.root, saved, 'text')).toBe(true)
})
