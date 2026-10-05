import { indexPdfText } from './search-text'
import {
  ANNOTATION_LIMITS,
  captureTextSelector,
  normalizeAnnotationSelector,
  projectPdfRectangle,
  type AnnotationSelector,
  type PdfAnnotationRect,
  type PdfAnnotationSegment,
} from '../annotations/selectors'

export function pdfTextIndex(layer: HTMLElement) {
  const walker = layer.ownerDocument.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  return { nodes, ...indexPdfText(nodes.map((node) => node.data)) }
}
export function pdfTextRange(layer: HTMLElement, start: number, end: number): Range | undefined {
  const index = pdfTextIndex(layer)
  const first = index.positions[start]
  const last = index.positions[end - 1]
  if (!first || !last) return
  const range = layer.ownerDocument.createRange()
  range.setStart(index.nodes[first.part]!, first.offset)
  range.setEnd(index.nodes[last.part]!, last.offset + 1)
  return range
}
function rotation(layer: HTMLElement): 0 | 90 | 180 | 270 {
  const value = Number(layer.dataset.mainRotation ?? 0)
  if (![0, 90, 180, 270].includes(value)) throw Error('Unsupported PDF page rotation.')
  return value as 0 | 90 | 180 | 270
}
export function capturePdfRectangles(
  range: Range,
  page: HTMLElement,
  layer: HTMLElement,
): PdfAnnotationRect[] {
  const box = page.getBoundingClientRect()
  if (!box.width || !box.height || !range.getClientRects) return []
  const inverse = ((360 - rotation(layer)) % 360) as 0 | 90 | 180 | 270
  const rectangles = [...range.getClientRects()].flatMap((rect) => {
    const left = Math.max(box.left, rect.left),
      top = Math.max(box.top, rect.top)
    const right = Math.min(box.right, rect.right),
      bottom = Math.min(box.bottom, rect.bottom)
    if (right - left < 0.25 || bottom - top < 0.25) return []
    return [
      projectPdfRectangle(
        {
          x: (left - box.left) / box.width,
          y: (top - box.top) / box.height,
          width: (right - left) / box.width,
          height: (bottom - top) / box.height,
        },
        inverse,
      ),
    ]
  })
  // Fully selected spans can contribute both element and text rectangles.
  return [
    ...new Map(
      rectangles.map((rect) => [
        [rect.x, rect.y, rect.width, rect.height].map((value) => value.toFixed(6)).join(':'),
        rect,
      ]),
    ).values(),
  ]
}
/** Capture only a complete selection whose endpoints belong to this reader's ready text layers. */
export function capturePdfHighlight(
  root: HTMLElement,
  selection: Selection | null,
): AnnotationSelector | undefined {
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return
  const selected = selection.getRangeAt(0)
  const start = (
    selected.startContainer.nodeType === 1
      ? (selected.startContainer as Element)
      : selected.startContainer.parentElement
  )?.closest<HTMLElement>('.textLayer')
  const end = (
    selected.endContainer.nodeType === 1
      ? (selected.endContainer as Element)
      : selected.endContainer.parentElement
  )?.closest<HTMLElement>('.textLayer')
  if (!start || !end || !root.contains(start) || !root.contains(end)) return
  const firstPage = Number(start.closest('article')?.dataset.pdfPage)
  const lastPage = Number(end.closest('article')?.dataset.pdfPage)
  if (!firstPage || lastPage < firstPage || lastPage - firstPage >= ANNOTATION_LIMITS.segments)
    return
  const segments: PdfAnnotationSegment[] = []
  for (let pageNumber = firstPage; pageNumber <= lastPage; pageNumber++) {
    const shell = root.querySelector<HTMLElement>(`article[data-pdf-page="${pageNumber}"]`)
    const layer = shell?.querySelector<HTMLElement>('.textLayer')
    const page = shell?.querySelector<HTMLElement>('.pdf-page')
    if (!shell || shell.dataset.renderState !== 'ready' || !layer || !page) return
    const index = pdfTextIndex(layer)
    if (index.text.length > ANNOTATION_LIMITS.text) return
    const selectedParts = new Map<number, { start: number; end: number }>()
    index.nodes.forEach((node, part) => {
      if (!selected.intersectsNode(node)) return
      const a = node === selected.startContainer ? selected.startOffset : 0
      const b = node === selected.endContainer ? selected.endOffset : node.length
      if (b > a) selectedParts.set(part, { start: a, end: b })
    })
    const offsets: number[] = []
    index.positions.forEach((position, offset) => {
      if (!position) return
      const bounds = selectedParts.get(position.part)
      if (bounds && position.offset >= bounds.start && position.offset < bounds.end) {
        if (!offsets.length) offsets.push(offset)
        offsets[1] = offset + 1
      }
    })
    if (!offsets.length) return
    const from = Math.min(...offsets),
      to = Math.max(...offsets)
    let text
    try {
      text = captureTextSelector(index.text, from, to)
    } catch {
      return
    }
    const range = pdfTextRange(layer, from, to)
    if (!range) return
    const rectangles = capturePdfRectangles(range, page, layer)
    if (!rectangles.length) return
    segments.push({ page: pageNumber, text, rectangles })
  }
  return normalizeAnnotationSelector({ version: 1, format: 'PDF', segments })
}

export const PDF_HIGHLIGHT_COLORS = {
  yellow: '#facc15',
  green: '#4ade80',
  blue: '#60a5fa',
  pink: '#f472b6',
} as const
