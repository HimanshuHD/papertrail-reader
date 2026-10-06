import { afterEach, expect, it, vi } from 'vitest'
import {
  captureEpubHighlight,
  epubHighlightIndex,
  paintEpubHighlights,
} from '../../src/features/epub/highlights'
import type { EpubAnnotationContext } from '../../src/features/epub/epub-session'
import type { Annotation } from '../../src/services/annotation-storage'

const fingerprint = 'sha256-chunks-v1:' + 'a'.repeat(64)
afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
function context(
  html = '<p>Hello <em>world</em>.</p><p>Next paragraph.</p>',
): EpubAnnotationContext {
  const frame = document.createElement('iframe')
  document.body.append(frame)
  const doc = frame.contentDocument!
  doc.body.innerHTML = html
  return {
    document: doc,
    chapter: 0,
    mode: 'formatted',
    cfiFromRange: () => 'epubcfi(/6/2!/4/2:0)',
  }
}
function select(ctx: EpubAnnotationContext, element: Element) {
  const range = ctx.document.createRange()
  range.selectNodeContents(element)
  const selection = ctx.document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}
function saved(ctx: EpubAnnotationContext): Annotation {
  select(ctx, ctx.document.querySelector('p')!)
  return {
    version: 2,
    id: 'one',
    selector: captureEpubHighlight(ctx)!,
    color: 'yellow',
    note: '',
    createdAt: 1,
    updatedAt: 1,
  }
}
function registry(ctx: EpubAnnotationContext) {
  const highlights = new Map<string, unknown>()
  class Highlight {
    constructor(
      public first?: Range,
      ...ranges: Range[]
    ) {
      void ranges
    }
  }
  Object.defineProperty(ctx.document.defaultView!, 'Highlight', {
    configurable: true,
    value: Highlight,
  })
  Object.defineProperty(ctx.document.defaultView!, 'CSS', {
    configurable: true,
    value: { highlights },
  })
  return highlights
}
it('captures inline text without synthetic spaces and excludes image alternatives', () => {
  const ctx = context(
    '<p>hel<em>lo</em> world</p><div data-reader-image>Image alternative</div><p>Next</p>',
  )
  expect(epubHighlightIndex(ctx.document).text).toBe('hello world Next')
  const annotation = saved(ctx)
  expect(annotation.selector).toMatchObject({
    format: 'EPUB',
    chapter: 0,
    mode: 'formatted',
    text: { exact: 'hello world', start: 0, end: 11 },
    cfi: 'epubcfi(/6/2!/4/2:0)',
  })
  ctx.document.getSelection()!.removeAllRanges()
  expect(captureEpubHighlight(ctx)).toBeUndefined()
})
it('restores validated ranges across modes without mutating text, and disposes registry/styles', () => {
  const first = context(),
    annotation = saved(first)
  const second = context('<p>Hello world.</p><p>Next paragraph.</p>')
  second.mode = 'text'
  const highlights = registry(second),
    before = second.document.body.innerHTML
  const result = paintEpubHighlights(second, fingerprint, [annotation])
  expect(result.unsupported).toBe(false)
  expect(result.unresolved.size).toBe(0)
  expect(result.resolvedRanges.get('one')?.toString()).toBe('Hello world.')
  expect((highlights.get('papertrail-yellow') as { first: Range }).first.toString()).toBe(
    'Hello world.',
  )
  expect(second.document.body.innerHTML).toBe(before)
  expect(second.document.querySelector('[data-papertrail-highlights]')!.textContent).not.toMatch(
    /(?:^|[;{])color:/u,
  )
  result.dispose()
  expect(highlights.size).toBe(0)
  expect(second.document.querySelector('[data-papertrail-highlights]')).toBeNull()
})
it('marks changed quotes unresolved, leaves other chapters untouched and reports unsupported painters', () => {
  const first = context(),
    annotation = saved(first)
  const changed = context('<p>Completely different content</p>')
  const result = paintEpubHighlights(changed, fingerprint, [annotation])
  expect(result.unresolved.has('one')).toBe(true)
  expect(result.resolvedRanges.has('one')).toBe(false)
  expect(result.unsupported).toBe(true)
  changed.chapter = 1
  expect(paintEpubHighlights(changed, fingerprint, [annotation]).unresolved.size).toBe(0)
})
it('rejects external ranges and safely falls back to text when CFI construction fails', () => {
  const ctx = context()
  ctx.cfiFromRange = () => {
    throw Error('missing CFI')
  }
  const annotation = saved(ctx)
  expect(annotation.selector).toMatchObject({ format: 'EPUB', cfi: null })
  const range = ctx.document.createRange()
  range.selectNodeContents(ctx.document.head)
  ctx.document.getSelection()!.removeAllRanges()
  ctx.document.getSelection()!.addRange(range)
  expect(captureEpubHighlight(ctx)).toBeUndefined()
})
