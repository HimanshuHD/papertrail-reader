export interface SearchContext {
  before: string
  term: string
  after: string
  leading: boolean
  trailing: boolean
}
export interface TextMatch {
  start: number
  end: number
  occurrence: number
  context: SearchContext
}

/** Same canonical text for PDF extraction and rendered text nodes; retain source offsets. */
export function indexPdfText(parts: readonly string[]) {
  let text = ''
  const positions: ({ part: number; offset: number } | null)[] = []
  function append(char: string, position: { part: number; offset: number } | null) {
    if (/\s/u.test(char)) {
      if (!text || text.endsWith(' ')) return
      char = ' '
    }
    text += char
    positions.push(position)
  }
  parts.forEach((part, index) => {
    if (index) append(' ', null)
    for (let offset = 0; offset < part.length; offset++)
      append(part[offset]!, { part: index, offset })
  })
  if (text.endsWith(' ')) {
    text = text.slice(0, -1)
    positions.pop()
  }
  return { text, positions }
}

export function findTextMatches(text: string, query: string, limit = 200): TextMatch[] {
  const needle = query.replace(/\s+/gu, ' ').trim()
  if (!needle) return []
  const expression = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  const matches: TextMatch[] = []
  for (const match of text.matchAll(expression)) {
    const start = match.index
    const end = start + match[0].length
    const before = Array.from(text.slice(Math.max(0, start - 102), start))
    const after = Array.from(text.slice(end, end + 102))
    matches.push({
      start,
      end,
      occurrence: matches.length + 1,
      context: {
        before: before.slice(-50).join(''),
        term: match[0],
        after: after.slice(0, 50).join(''),
        leading: start > before.slice(-50).join('').length,
        trailing: text.length > end + after.slice(0, 50).join('').length,
      },
    })
    if (matches.length >= limit) break
  }
  return matches
}

/** Ranges preserve PDF.js glyph placement; no replacement of PDF text or HTML parsing. */
export function textLayerMatchRanges(layer: HTMLElement, query: string) {
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  const indexed = indexPdfText(nodes.map((node) => node.data))
  return findTextMatches(indexed.text, query).flatMap((match) => {
    const first = indexed.positions[match.start]
    const last = indexed.positions[match.end - 1]
    if (!first || !last) return []
    const range = document.createRange()
    range.setStart(nodes[first.part]!, first.offset)
    range.setEnd(nodes[last.part]!, last.offset + 1)
    return [{ occurrence: match.occurrence, range }]
  })
}
