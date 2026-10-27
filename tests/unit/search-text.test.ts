import { describe, expect, it } from 'vitest'
import {
  findTextMatches,
  indexPdfText,
  canonicalPdfText,
  textLayerMatchRanges,
} from '../../src/features/pdf/search-text'

describe('PDF search context and text-layer mapping', () => {
  it('limits Unicode context to 50 characters per side without splitting emoji', () => {
    const text = '😀'.repeat(60) + 'Needle' + 'z'.repeat(60)
    const [match] = findTextMatches(text, 'needle')
    expect(Array.from(match!.context.before)).toHaveLength(50)
    expect(Array.from(match!.context.after)).toHaveLength(50)
    expect(match!.context.term).toBe('Needle')
    expect(match!.context.leading && match!.context.trailing).toBe(true)
    expect(match!.start).toBe(120)
  })
  it('matches literal punctuation, folded Unicode and repeated occurrences', () => {
    const matches = findTextMatches('a+b A+B K k', 'a+b')
    expect(matches.map((m) => m.occurrence)).toEqual([1, 2])
    expect(findTextMatches('K k', 'k')).toHaveLength(2)
    expect(findTextMatches('needle needle needle', 'needle', 2)).toHaveLength(2)
    expect(findTextMatches('anything', '  ')).toEqual([])
  })
  it('maps a wrapped match across nested text spans without modifying PDF markup', () => {
    const layer = document.createElement('div')
    for (const text of ['  One', 'wrapped\n', 'TERM  and', 'wrapped term']) {
      const span = document.createElement('span')
      span.textContent = text
      layer.append(span)
    }
    const before = layer.innerHTML
    expect(indexPdfText(['  One', 'wrapped\n', 'TERM  and', 'wrapped term']).text).toBe(
      'One wrapped TERM and wrapped term',
    )
    const ranges = textLayerMatchRanges(layer, 'WRAPPED   term')
    expect(ranges.map((m) => m.occurrence)).toEqual([1, 2])
    expect(ranges[0]!.range.toString()).toBe('wrapped\nTERM')
    expect(layer.innerHTML).toBe(before)
  })
  it('keeps short edge excerpts intact and treats HTML-like text literally', () => {
    const [match] = findTextMatches('<img onerror=alert(1)>', '<img')
    expect(match!.context).toEqual({
      before: '',
      term: '<img',
      after: ' onerror=alert(1)>',
      leading: false,
      trailing: false,
    })
  })
})

it('normalizes dense PDF text without changing UTF-16 source anchors or search-only text', () => {
  const body = 'Alpha beta '.repeat(24000)
  const parts = ['  ' + body, '\t🌿\u00a0tail\n']
  const indexed = indexPdfText(parts)
  expect(indexed.text).toBe(body.trimEnd() + ' 🌿 tail')
  expect(canonicalPdfText(parts)).toBe(indexed.text)
  expect(indexed.positions).toHaveLength(indexed.text.length)
  const leaf = indexed.text.indexOf('🌿')
  expect(indexed.positions[leaf]).toEqual({ part: 1, offset: 1 })
  expect(indexed.positions[leaf + 1]).toEqual({ part: 1, offset: 2 })
  expect(indexPdfText(['One', 'Two']).positions[3]).toBeNull()
  expect(canonicalPdfText([' ', '', '\t'])).toBe('')
  expect(findTextMatches(indexed.text, '🌿 tail')[0]?.start).toBe(leaf)
})

it('keeps search-only normalization identical for Unicode whitespace, empty parts and surrogate units', () => {
  for (const gap of [
    ' ',
    '\t',
    '\r\n',
    '\v',
    '\f',
    '\u00a0',
    '\u1680',
    '\u2000',
    '\u2007',
    '\u2028',
    '\u2029',
    '\u202f',
    '\u205f',
    '\u3000',
    '\ufeff',
  ]) {
    const parts = [gap, 'A' + gap + '🌿', '', gap + 'tail', gap]
    expect(canonicalPdfText(parts)).toBe(indexPdfText(parts).text)
  }
  expect(canonicalPdfText(['\ud800', '\udfff'])).toBe(indexPdfText(['\ud800', '\udfff']).text)
})
