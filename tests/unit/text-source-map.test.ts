import { expect, it } from 'vitest'
import { TextSourceMapBuilder } from '../../src/features/annotations/text-source-map'
import { indexPdfText } from '../../src/features/pdf/search-text'
import { epubHighlightIndex } from '../../src/features/epub/highlights'

it('preserves UTF-16 offsets, collapsed whitespace and unmapped PDF separators', () => {
  const index = indexPdfText([' \tA🌿  B', '', '\nC\u00a0D '])
  const expected = [
    { part: 0, offset: 2 },
    { part: 0, offset: 3 },
    { part: 0, offset: 4 },
    { part: 0, offset: 5 },
    { part: 0, offset: 7 },
    null,
    { part: 2, offset: 1 },
    { part: 2, offset: 2 },
    { part: 2, offset: 3 },
  ]
  expect(index.text).toBe('A🌿 B C D')
  expect(Array.from({ length: index.text.length }, (_, i) => index.source.at(i))).toEqual(expected)
  for (let part = 0; part < 3; part++)
    for (let start = 0; start < 9; start++)
      for (let end = start; end <= 9; end++) {
        const selected = expected.flatMap((value, i) =>
          value?.part === part && value.offset >= start && value.offset < end ? [i] : [],
        )
        expect(index.source.bounds(new Map([[part, { start, end }]]))).toEqual(
          selected.length ? [selected[0], selected.at(-1)! + 1] : undefined,
        )
      }
  expect(index.source.at(-1)).toBeUndefined()
  expect(index.source.at(index.text.length)).toBeUndefined()
  expect(index.source.at(NaN)).toBeUndefined()
})
it('preserves EPUB block separators mapped to the next node, including duplicate source points', () => {
  const doc = document.implementation.createHTMLDocument()
  doc.body.innerHTML = '<p>A<em>🌿</em> B</p><p>C</p><p data-reader-image="">Excluded</p>'
  const index = epubHighlightIndex(doc)
  expect(index.text).toBe('A🌿 B C')
  const boundary = index.text.lastIndexOf(' ')
  expect(index.source.at(boundary)).toEqual({ part: 3, offset: 0 })
  expect(index.source.at(boundary + 1)).toEqual({ part: 3, offset: 0 })
  expect(index.source.bounds(new Map([[3, { start: 0, end: 1 }]]))).toEqual([
    boundary,
    boundary + 2,
  ])
})
it('stores dense contiguous text in a span and keeps empty/trimmed maps valid', () => {
  const dense = indexPdfText(['a'.repeat(250000)])
  expect(dense.source.spanCount).toBe(1)
  expect(dense.source.storageBytes).toBeLessThan(64)
  expect(dense.source.at(249999)).toEqual({ part: 0, offset: 249999 })
  const empty = indexPdfText([' ', '', '\t'])
  expect(empty.source.length).toBe(0)
  expect(empty.source.at(0)).toBeUndefined()
  expect(empty.source.bounds(new Map())).toBeUndefined()
})
it('grows fragmented storage without changing earlier snapshots and trims a singleton tail', () => {
  const builder = new TextSourceMapBuilder()
  for (let part = 0; part < 100; part++) builder.append(part, part * 2)
  const first = builder.finish()
  builder.append(null)
  builder.trimLast()
  builder.append(100, 2)
  const next = builder.finish()
  expect(first.length).toBe(100)
  expect(first.at(99)).toEqual({ part: 99, offset: 198 })
  expect(first.at(100)).toBeUndefined()
  expect(next.at(100)).toEqual({ part: 100, offset: 2 })
})
