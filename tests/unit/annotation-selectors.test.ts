import { expect, it } from 'vitest'
import {
  annotationIdentity,
  captureTextSelector,
  normalizeAnnotationSelector,
  projectPdfRectangle,
  resolvePdfAnnotation,
  resolveEpubAnnotation,
  type AnnotationIdentity,
  type AnnotationSelector,
} from '../../src/features/annotations/selectors'

const pdf: AnnotationIdentity = { format: 'PDF', fingerprint: 'sha256-chunks-v1:' + 'a'.repeat(64) }
const epub: AnnotationIdentity = { ...pdf, format: 'EPUB' }
const text = 'Before reading this book, take a breath.'
const quote = captureTextSelector(text, 7, 14)
const rect = { x: 0.1, y: 0.2, width: 0.3, height: 0.1 }
const pdfSelector: AnnotationSelector = {
  version: 1,
  format: 'PDF',
  segments: [{ page: 2, text: quote, rectangles: [rect] }],
}
const epubSelector: AnnotationSelector = {
  version: 1,
  format: 'EPUB',
  chapter: 1,
  mode: 'formatted',
  cfi: 'epubcfi(/6/4!/4/2,/1:7,/1:14)',
  text: quote,
}

it('validates identities/selectors without copying foreign fields, bytes or markup', () => {
  expect(annotationIdentity({ ...pdf, bytes: new Blob(['document']) })).toEqual(pdf)
  expect(annotationIdentity({ ...pdf, fingerprint: 'name.pdf' })).toBeUndefined()
  expect(normalizeAnnotationSelector({ ...pdfSelector, file: new Blob(['document']) })).toEqual(
    pdfSelector,
  )
  for (const value of [
    null,
    [],
    { ...epubSelector, chapter: -1 },
    { ...epubSelector, cfi: '<script>' },
    { ...epubSelector, text: { ...quote, start: -1 } },
    { ...epubSelector, text: { ...quote, end: 999 } },
    { ...epubSelector, version: 5 },
    { ...pdfSelector, segments: [{ page: 0, text: quote, rectangles: [rect] }] },
    {
      ...pdfSelector,
      segments: [{ page: 2, text: quote, rectangles: [{ ...rect, x: Infinity }] }],
    },
    { ...pdfSelector, segments: [{ page: 2, text: quote, rectangles: [{ ...rect, width: 2 }] }] },
    { ...pdfSelector, segments: [{ page: 2, text: quote, rectangles: [] }] },
  ])
    expect(normalizeAnnotationSelector(value)).toBeUndefined()
  expect(() => captureTextSelector(text, 0, 999)).toThrow()
})
it('retains precise PDF page selectors and requires every page of a multi-page selection', () => {
  const selector = {
    ...pdfSelector,
    segments: [...pdfSelector.segments, { page: 3, text: quote, rectangles: [rect] }],
  }
  const pages = new Map([
    [2, text],
    [3, text],
  ])
  expect(resolvePdfAnnotation(pdf, pdf, selector, pages)).toMatchObject({
    status: 'resolved',
    value: [
      { page: 2, start: 7, end: 14, rectangles: [rect] },
      { page: 3, start: 7 },
    ],
  })
  pages.delete(3)
  expect(resolvePdfAnnotation(pdf, pdf, selector, pages)).toEqual({
    status: 'unresolved',
    reason: 'missing-content',
  })
  expect(
    resolvePdfAnnotation(
      pdf,
      { ...pdf, fingerprint: 'sha256-chunks-v1:' + 'b'.repeat(64) },
      selector,
      pages,
    ),
  ).toEqual({ status: 'unresolved', reason: 'document-changed' })
  expect(resolvePdfAnnotation(epub, epub, selector, pages)).toMatchObject({
    reason: 'invalid-selector',
  })
})
it('projects unrotated geometry for all rotations independently of zoom', () => {
  expect(projectPdfRectangle(rect, 0)).toEqual(rect)
  expect(projectPdfRectangle(rect, 90)).toMatchObject({ y: 0.1, width: 0.1, height: 0.3 })
  expect(projectPdfRectangle(rect, 180).x).toBeCloseTo(0.6)
  expect(projectPdfRectangle(rect, 270).y).toBeCloseTo(0.6)
  for (const rotation of [0, 90, 180, 270] as const) {
    const rotated = projectPdfRectangle(rect, rotation)
    const inverse = ((360 - rotation) % 360) as 0 | 90 | 180 | 270
    const restored = projectPdfRectangle(rotated, inverse)
    for (const key of ['x', 'y', 'width', 'height'] as const)
      expect(restored[key]).toBeCloseTo(rect[key])
    const edge = projectPdfRectangle({ x: 0.8, y: 0.8, width: 0.2, height: 0.2 }, rotation)
    expect(edge.x).toBeGreaterThanOrEqual(0)
    expect(edge.y).toBeGreaterThanOrEqual(0)
    expect(() => projectPdfRectangle(edge, inverse)).not.toThrow()
  }
})
it('validates EPUB CFI offsets against text and falls back across mode/DOM differences', () => {
  const chapter = {
    index: 1,
    mode: 'formatted' as const,
    text,
    cfiOffsets: () => ({ start: 7, end: 14 }),
  }
  expect(resolveEpubAnnotation(epub, epub, epubSelector, chapter)).toMatchObject({
    status: 'resolved',
    value: { source: 'cfi' },
  })
  for (const changes of [
    { mode: 'text' as const },
    { cfiOffsets: () => ({ start: 3, end: 10 }) },
    {
      cfiOffsets: () => {
        throw Error('invalid CFI')
      },
    },
  ])
    expect(
      resolveEpubAnnotation(epub, epub, epubSelector, { ...chapter, ...changes }),
    ).toMatchObject({ status: 'resolved', value: { source: 'text', start: 7, end: 14 } })
  expect(
    resolveEpubAnnotation(epub, epub, epubSelector, { ...chapter, text: 'entirely changed' }),
  ).toEqual({ status: 'unresolved', reason: 'quote-mismatch' })
  expect(resolveEpubAnnotation(epub, epub, epubSelector, { ...chapter, index: 2 })).toEqual({
    status: 'unresolved',
    reason: 'missing-content',
  })
})
it('requires a unique context match for moved text and discards stale PDF geometry', () => {
  const moved = resolvePdfAnnotation(pdf, pdf, pdfSelector, new Map([[2, 'Intro: ' + text]]))
  expect(moved).toMatchObject({
    status: 'resolved',
    value: [{ start: 14, reanchored: true, rectangles: [] }],
  })
  expect(
    resolveEpubAnnotation(
      epub,
      epub,
      { ...epubSelector, text: { start: 0, end: 7, exact: 'reading', prefix: '', suffix: '' } },
      { index: 1, mode: 'text', text: 'Now reading, then reading.' },
    ),
  ).toEqual({ status: 'unresolved', reason: 'ambiguous-quote' })
})
it('uses UTF-16 end-exclusive offsets and does not guess across whitespace mismatches', () => {
  const unicode = '🌻 café, a book'
  const selected = captureTextSelector(unicode, 3, 7)
  expect(selected.exact).toBe('café')
  expect(
    resolveEpubAnnotation(
      epub,
      epub,
      { ...epubSelector, text: selected },
      { index: 1, mode: 'text', text: unicode },
    ),
  ).toMatchObject({ value: { start: 3, end: 7 } })
  expect(
    resolveEpubAnnotation(epub, epub, epubSelector, {
      index: 1,
      mode: 'text',
      text: text.replace('Before ', 'Before  '),
    }),
  ).toMatchObject({ reason: 'quote-mismatch' })
})

it('bounds repeated-quote searches and oversized selection geometry', () => {
  expect(
    resolveEpubAnnotation(
      epub,
      epub,
      { ...epubSelector, text: { start: 0, end: 1, exact: 'a', prefix: 'z', suffix: '' } },
      { index: 1, mode: 'text', text: 'a'.repeat(20001) },
    ),
  ).toEqual({ status: 'unresolved', reason: 'resolution-limit' })
  expect(
    normalizeAnnotationSelector({
      ...pdfSelector,
      segments: [{ page: 2, text: quote, rectangles: Array(1001).fill(rect) }],
    }),
  ).toBeUndefined()
})
