import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import {
  capturePdfHighlight,
  capturePdfRectangles,
  pdfTextIndex,
  pdfTextRange,
  revealPdfHighlight,
} from '../../src/features/pdf/highlights'
import { usePdfHighlights } from '../../src/composables/usePdfHighlights'
import type {
  Annotation,
  AnnotationStorage,
  AnnotationHandle,
} from '../../src/services/annotation-storage'
import type { AnnotationSelector } from '../../src/features/annotations/selectors'

afterEach(() => {
  document.body.replaceChildren()
  document.getSelection()?.removeAllRanges()
  vi.restoreAllMocks()
})
function page(root: HTMLElement, number: number, parts: string[]) {
  const shell = document.createElement('article')
  shell.dataset.pdfPage = String(number)
  shell.dataset.renderState = 'ready'
  shell.innerHTML = '<div class="pdf-page"><div class="textLayer"></div></div>'
  const layer = shell.querySelector<HTMLElement>('.textLayer')!
  parts.forEach((text) => {
    const span = document.createElement('span')
    span.textContent = text
    layer.append(span)
  })
  vi.spyOn(shell.querySelector('.pdf-page')!, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 100,
    bottom: 200,
    width: 100,
    height: 200,
  } as DOMRect)
  root.append(shell)
  return { shell, layer }
}
function select(a: Text, start: number, b: Text, end: number) {
  const range = document.createRange()
  range.setStart(a, start)
  range.setEnd(b, end)
  document.getSelection()!.removeAllRanges()
  document.getSelection()!.addRange(range)
}
function setupDom() {
  const root = document.createElement('div')
  document.body.append(root)
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [{ left: 10, top: 20, right: 60, bottom: 40, width: 50, height: 20 }],
  })
  return root
}
it('captures complete multi-line and multi-page text selections with source offsets', () => {
  const root = setupDom()
  const first = page(root, 1, ['First ', 'wrapped line'])
  const second = page(root, 2, ['Second page'])
  select(
    first.layer.firstChild!.firstChild as Text,
    1,
    second.layer.firstChild!.firstChild as Text,
    6,
  )
  const annotation = capturePdfHighlight(root, document.getSelection())
  expect(annotation).toMatchObject({
    format: 'PDF',
    segments: [
      { page: 1, text: { exact: 'irst wrapped line', start: 1 } },
      { page: 2, text: { exact: 'Second', start: 0, end: 6 } },
    ],
  })
  expect(first.layer.textContent).toBe('First wrapped line')
})
it('rejects collapsed, external, missing-layer, partly virtualized and image-only selections', () => {
  const root = setupDom(),
    first = page(root, 1, ['One']),
    second = page(root, 2, ['Two'])
  select(
    first.layer.firstChild!.firstChild as Text,
    0,
    second.layer.firstChild!.firstChild as Text,
    3,
  )
  second.shell.dataset.renderState = 'pending'
  expect(capturePdfHighlight(root, document.getSelection())).toBeUndefined()
  second.shell.dataset.renderState = 'ready'
  first.layer.innerHTML = ''
  expect(capturePdfHighlight(root, document.getSelection())).toBeUndefined()
  expect(capturePdfHighlight(root, null)).toBeUndefined()
  expect(
    capturePdfHighlight(document.createElement('div'), document.getSelection()),
  ).toBeUndefined()
})
it('maps canonical wrapped text without modifying nodes and projects rotated crop geometry', () => {
  const root = setupDom(),
    { layer, shell } = page(root, 1, ['  Wrapped\n', 'text  here'])
  expect(pdfTextIndex(layer).text).toBe('Wrapped text here')
  const range = pdfTextRange(layer, 0, 12)!
  expect(range.toString()).toBe('Wrapped\ntext')
  layer.dataset.mainRotation = '90'
  const [rect] = capturePdfRectangles(range, shell.querySelector<HTMLElement>('.pdf-page')!, layer)
  expect(rect!.x).toBeCloseTo(0.1)
  expect(rect!.y).toBeCloseTo(0.4)
  expect(rect!.width).toBeCloseTo(0.1)
  expect(rect!.height).toBeCloseTo(0.5)
})
const digest = 'sha256-chunks-v1:' + 'a'.repeat(64)
const selector: AnnotationSelector = {
  version: 1,
  format: 'PDF',
  segments: [
    {
      page: 1,
      text: { start: 0, end: 3, exact: 'One', prefix: '', suffix: '' },
      rectangles: [{ x: 0.1, y: 0.1, width: 0.3, height: 0.1 }],
    },
  ],
}
const annotation: Annotation = {
  id: 'one',
  version: 2,
  selector,
  color: 'yellow',
  note: '',
  createdAt: 1,
  updatedAt: 1,
}
function setupStorage() {
  const fingerprint = ref<string | null>(digest)
  const handle: AnnotationHandle = {
    identity: { format: 'PDF', fingerprint: digest },
    generation: 'one',
  }
  const storage: AnnotationStorage = {
    open: vi.fn(async (identity) => ({ handle: { ...handle, identity }, annotations: [] })),
    list: vi.fn(async () => [annotation]),
    create: vi.fn(async () => annotation),
    update: vi.fn(async () => annotation),
    remove: vi.fn(async () => undefined),
    clearDocument: vi.fn(async () => undefined),
  }
  let state!: ReturnType<typeof usePdfHighlights>
  const wrapper = mount({
    setup() {
      state = usePdfHighlights(fingerprint, storage)
      return () => null
    },
  })
  return { state, storage, fingerprint, wrapper }
}
it('serializes user mutations, reloads only committed changes, and locks failures until retry', async () => {
  const { state, storage, wrapper } = setupStorage()
  await flushPromises()
  expect(await state.add(selector, 'blue')).toBe(true)
  expect(state.highlights.value).toEqual([annotation])
  vi.mocked(storage.list).mockRejectedValueOnce(Error('connection lost'))
  expect(await state.recolor('one', 'pink')).toBe(false)
  expect(state.notice.value).toContain('was saved')
  expect(state.handle.value).toBeNull()
  expect(await state.add(selector, 'yellow')).toBe(false)
  await state.reload()
  expect(state.handle.value).not.toBeNull()
  vi.mocked(storage.remove).mockRejectedValueOnce(Error('quota'))
  expect(await state.remove('one')).toBe(false)
  expect(state.notice.value).toContain('could not be saved')
  wrapper.unmount()
})
it('never publishes stale loading or mutation results after document switching', async () => {
  const { state, storage, fingerprint, wrapper } = setupStorage()
  await flushPromises()
  let finish!: (a: Annotation[]) => void
  vi.mocked(storage.list).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const pending = state.add(selector, 'yellow')
  await flushPromises()
  fingerprint.value = 'sha256-chunks-v1:' + 'b'.repeat(64)
  await flushPromises()
  finish([annotation])
  expect(await pending).toBe(false)
  expect(state.highlights.value).toEqual([])
  expect(state.handle.value?.identity.fingerprint).toBe(fingerprint.value)
  let load!: (a: Awaited<ReturnType<AnnotationStorage['open']>>) => void
  vi.mocked(storage.open).mockReturnValueOnce(
    new Promise((resolve) => {
      load = resolve
    }),
  )
  const retry = state.reload()
  fingerprint.value = null
  load({
    handle: { identity: { format: 'PDF', fingerprint: digest }, generation: 'old' },
    annotations: [annotation],
  })
  await retry
  expect(state.highlights.value).toEqual([])
  expect(state.loading.value).toBe(false)
  wrapper.unmount()
})

it('joins overlapping and adjacent runs without bridging lines or columns', () => {
  const root = setupDom()
  const { shell, layer } = page(root, 1, ['Paragraph'])
  const range = pdfTextRange(layer, 0, 9)!
  Object.defineProperty(range, 'getClientRects', {
    value: () => [
      { left: 5, top: 10, right: 30, bottom: 20 },
      { left: 5, top: 10.1, right: 30, bottom: 20.1 },
      { left: 32, top: 10, right: 45, bottom: 20 },
      { left: 70, top: 10, right: 90, bottom: 20 },
      { left: 5, top: 25, right: 45, bottom: 35 },
    ],
  })
  const rectangles = capturePdfRectangles(range, shell.querySelector('.pdf-page')!, layer)
  expect(rectangles).toHaveLength(3)
  expect(rectangles[0]).toMatchObject({ x: 0.05, y: 0.05, width: 0.4 })
  expect(rectangles.some((rect) => rect.x === 0.7)).toBe(true)
  expect(rectangles.some((rect) => rect.y === 0.125)).toBe(true)
})

it('reveals verified text inside the PDF pane and waits for virtualized layers', () => {
  const root = setupDom()
  const { shell } = page(root, 1, ['One'])
  Object.defineProperties(root, {
    clientHeight: { value: 400 },
    scrollHeight: { value: 2000 },
  })
  root.scrollTop = 300
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ top: 0 } as DOMRect)
  expect(revealPdfHighlight(root, digest, selector)).toBe(true)
  expect(root.scrollTop).toBe(296)
  shell.dataset.renderState = 'pending'
  root.scrollTop = 300
  expect(revealPdfHighlight(root, digest, selector)).toBe(false)
  expect(root.scrollTop).toBe(300)
})
it('does not reveal a PDF highlight when its saved quote no longer resolves', () => {
  const root = setupDom()
  page(root, 1, ['Changed content'])
  root.scrollTop = 300
  expect(revealPdfHighlight(root, digest, selector)).toBe(false)
  expect(root.scrollTop).toBe(300)
})
