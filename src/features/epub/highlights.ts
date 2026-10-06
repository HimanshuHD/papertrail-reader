import {
  ANNOTATION_LIMITS,
  captureTextSelector,
  normalizeAnnotationSelector,
  resolveEpubAnnotation,
  type AnnotationSelector,
} from '../annotations/selectors'
import type { Annotation } from '../../services/annotation-storage'
import type { EpubAnnotationContext } from './epub-session'

/** Canonical text excludes reader image alternatives; inline node boundaries add no spaces. */
export function epubHighlightIndex(doc: Document) {
  const nodes: Text[] = [],
    positions: { node: Text; offset: number }[] = []
  const walker = doc.createTreeWalker(doc.body, 4)
  let text = '',
    previousBlock: Element | null = null
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.parentElement?.closest('[data-reader-image],script,style')) continue
    if (nodes.length >= 20000 || text.length + node.length > ANNOTATION_LIMITS.text)
      throw Error('Chapter text is too large to highlight.')
    const block =
      node.parentElement?.closest('p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th') ?? doc.body
    if (previousBlock && block !== previousBlock && text && !text.endsWith(' ')) {
      text += ' '
      positions.push({ node, offset: 0 })
    }
    previousBlock = block
    nodes.push(node)
    for (let offset = 0; offset < node.length; offset++) {
      let char = node.data[offset]!
      if (/\s/u.test(char)) {
        if (!text || text.endsWith(' ')) continue
        char = ' '
      }
      text += char
      positions.push({ node, offset })
    }
  }
  if (text.endsWith(' ')) {
    text = text.slice(0, -1)
    positions.pop()
  }
  return { text, nodes, positions }
}
function rangeAt(
  index: ReturnType<typeof epubHighlightIndex>,
  doc: Document,
  start: number,
  end: number,
) {
  const first = index.positions[start],
    last = index.positions[end - 1]
  if (!first || !last) return
  const range = doc.createRange()
  range.setStart(first.node, first.offset)
  range.setEnd(last.node, last.offset + 1)
  return range
}
export function captureEpubHighlight(
  context: EpubAnnotationContext,
): AnnotationSelector | undefined {
  const doc = context.document,
    selection = doc.getSelection()
  if (!selection?.rangeCount || selection.rangeCount !== 1 || selection.isCollapsed) return
  const range = selection.getRangeAt(0)
  if (!doc.body.contains(range.startContainer) || !doc.body.contains(range.endContainer)) return
  try {
    const index = epubHighlightIndex(doc),
      offsets: number[] = []
    index.positions.forEach((position, offset) => {
      const node = position.node
      if (!range.intersectsNode(node)) return
      const from = node === range.startContainer ? range.startOffset : 0
      const to = node === range.endContainer ? range.endOffset : node.length
      if (position.offset >= from && position.offset < to) {
        if (!offsets.length) offsets.push(offset)
        offsets[1] = offset + 1
      }
    })
    if (!offsets.length) return
    let cfi: string | null = null
    try {
      cfi = context.cfiFromRange?.(range) ?? null
    } catch {
      /* Validated text remains authoritative. */
    }
    return normalizeAnnotationSelector({
      version: 1,
      format: 'EPUB',
      chapter: context.chapter,
      mode: context.mode,
      cfi,
      text: captureTextSelector(index.text, offsets[0]!, offsets.at(-1)!),
    })
  } catch {
    return
  }
}
type HighlightWindow = {
  Highlight?: new (...ranges: Range[]) => unknown
  CSS?: { highlights?: { set(name: string, value: unknown): void; delete(name: string): void } }
}
const colors = {
  yellow: 'rgb(253 230 138 / 65%)',
  green: 'rgb(187 247 208 / 65%)',
  blue: 'rgb(191 219 254 / 65%)',
  pink: 'rgb(251 207 232 / 65%)',
}
export function paintEpubHighlights(
  context: EpubAnnotationContext,
  fingerprint: string,
  annotations: Annotation[],
) {
  const doc = context.document,
    win = doc.defaultView as unknown as HighlightWindow
  const registry = win?.CSS?.highlights,
    Constructor = win?.Highlight
  const unresolved = new Set<string>(),
    identity = { format: 'EPUB' as const, fingerprint }
  const ranges = new Map<keyof typeof colors, Range[]>()
  const resolvedRanges = new Map<string, Range>()
  let index: ReturnType<typeof epubHighlightIndex> | undefined
  try {
    index = epubHighlightIndex(doc)
  } catch {
    /* Refuse oversized chapter. */
  }
  for (const annotation of annotations) {
    if (annotation.selector.format !== 'EPUB' || annotation.selector.chapter !== context.chapter)
      continue
    const result =
      index &&
      resolveEpubAnnotation(identity, identity, annotation.selector, {
        index: context.chapter,
        mode: context.mode,
        text: index.text,
      })
    const range =
      result?.status === 'resolved' && index
        ? rangeAt(index, doc, result.value.start, result.value.end)
        : undefined
    if (!range) {
      unresolved.add(annotation.id)
      continue
    }
    resolvedRanges.set(annotation.id, range)
    const group = ranges.get(annotation.color) ?? []
    group.push(range)
    ranges.set(annotation.color, group)
  }
  let style: HTMLStyleElement | undefined
  if (registry && Constructor) {
    style = doc.createElement('style')
    style.dataset.papertrailHighlights = 'true'
    style.textContent = Object.entries(colors)
      .map(([color, value]) => `::highlight(papertrail-${color}){background-color:${value};}`)
      .join('\n')
    doc.head.append(style)
    for (const color of Object.keys(colors) as (keyof typeof colors)[])
      registry.set(`papertrail-${color}`, new Constructor(...(ranges.get(color) ?? [])))
  }
  return {
    resolvedRanges,
    unresolved,
    unsupported: !registry || !Constructor,
    dispose() {
      style?.remove()
      for (const color of Object.keys(colors)) registry?.delete(`papertrail-${color}`)
    },
  }
}
