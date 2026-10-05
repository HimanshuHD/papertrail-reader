export const ANNOTATION_LIMITS = {
  annotations: 1000,
  segments: 100,
  rectangles: 1000,
  quote: 10000,
  context: 64,
  text: 8388608,
  note: 4000,
  documentCharacters: 2000000,
  documentRectangles: 10000,
  quoteCandidates: 20000,
} as const

export interface AnnotationIdentity {
  format: 'PDF' | 'EPUB'
  fingerprint: string
}
export interface TextSelector {
  /** UTF-16 offsets into the adapter's canonical text, end exclusive. */
  start: number
  end: number
  exact: string
  prefix: string
  suffix: string
}
/** Fractions of the unrotated page, with origin at its top left. */
export interface PdfAnnotationRect {
  x: number
  y: number
  width: number
  height: number
}
export interface PdfAnnotationSegment {
  page: number
  text: TextSelector
  rectangles: PdfAnnotationRect[]
}
export type AnnotationSelector =
  | { version: 1; format: 'PDF'; segments: PdfAnnotationSegment[] }
  | {
      version: 1
      format: 'EPUB'
      chapter: number
      mode: 'formatted' | 'text'
      cfi: string | null
      text: TextSelector
    }

export function annotationIdentity(value: unknown): AnnotationIdentity | undefined {
  if (!value || typeof value !== 'object') return
  const v = value as Partial<AnnotationIdentity>
  if (
    (v.format !== 'PDF' && v.format !== 'EPUB') ||
    typeof v.fingerprint !== 'string' ||
    !/^sha256-chunks-v1:[a-f0-9]{64}$/u.test(v.fingerprint)
  )
    return
  return { format: v.format, fingerprint: v.fingerprint }
}
function textSelector(value: unknown): TextSelector | undefined {
  if (!value || typeof value !== 'object') return
  const v = value as Partial<TextSelector>
  if (
    !Number.isSafeInteger(v.start) ||
    !Number.isSafeInteger(v.end) ||
    v.start! < 0 ||
    v.end! <= v.start! ||
    v.end! > ANNOTATION_LIMITS.text ||
    typeof v.exact !== 'string' ||
    !v.exact.trim() ||
    v.exact.length > ANNOTATION_LIMITS.quote ||
    v.end! - v.start! !== v.exact.length ||
    typeof v.prefix !== 'string' ||
    v.prefix.length > ANNOTATION_LIMITS.context ||
    typeof v.suffix !== 'string' ||
    v.suffix.length > ANNOTATION_LIMITS.context
  )
    return
  return { start: v.start!, end: v.end!, exact: v.exact, prefix: v.prefix, suffix: v.suffix }
}
function rectangle(value: unknown): PdfAnnotationRect | undefined {
  if (!value || typeof value !== 'object') return
  const v = value as PdfAnnotationRect
  if (
    ![v.x, v.y, v.width, v.height].every(Number.isFinite) ||
    v.x < 0 ||
    v.y < 0 ||
    v.x >= 1 ||
    v.y >= 1 ||
    v.width <= 0 ||
    v.height <= 0 ||
    v.x + v.width > 1.000000001 ||
    v.y + v.height > 1.000000001
  )
    return
  return {
    x: v.x,
    y: v.y,
    width: Math.min(v.width, 1 - v.x),
    height: Math.min(v.height, 1 - v.y),
  }
}
export function normalizeAnnotationSelector(value: unknown): AnnotationSelector | undefined {
  if (!value || typeof value !== 'object') return
  const v = value as Partial<AnnotationSelector>
  if (v.version !== 1) return
  if (v.format === 'PDF') {
    if (
      !Array.isArray(v.segments) ||
      !v.segments.length ||
      v.segments.length > ANNOTATION_LIMITS.segments
    )
      return
    const segments: PdfAnnotationSegment[] = []
    let rectangleCount = 0
    for (const item of v.segments) {
      if (
        !item ||
        !Number.isSafeInteger(item.page) ||
        item.page < 1 ||
        !Array.isArray(item.rectangles) ||
        !item.rectangles.length
      )
        return
      rectangleCount += item.rectangles.length
      if (rectangleCount > ANNOTATION_LIMITS.rectangles) return
      const text = textSelector(item.text)
      const rectangles = item.rectangles.map(rectangle)
      if (!text || rectangles.some((v) => !v)) return
      segments.push({ page: item.page, text, rectangles: rectangles as PdfAnnotationRect[] })
    }
    return { version: 1, format: 'PDF', segments }
  }
  if (v.format === 'EPUB') {
    const text = textSelector(v.text)
    if (
      !text ||
      !Number.isSafeInteger(v.chapter) ||
      v.chapter! < 0 ||
      v.chapter! >= 10000 ||
      !['formatted', 'text'].includes(v.mode ?? '') ||
      (v.cfi !== null &&
        (typeof v.cfi !== 'string' || v.cfi.length > 2048 || !/^epubcfi\([^\s<>]+\)$/u.test(v.cfi)))
    )
      return
    return {
      version: 1,
      format: 'EPUB',
      chapter: v.chapter!,
      mode: v.mode as 'formatted' | 'text',
      cfi: v.cfi!,
      text,
    }
  }
}

export function captureTextSelector(text: string, start: number, end: number): TextSelector {
  if (text.length > ANNOTATION_LIMITS.text || end > text.length)
    throw new RangeError('Annotation text exceeds its bounds.')
  const result = textSelector({
    start,
    end,
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - ANNOTATION_LIMITS.context), start),
    suffix: text.slice(end, end + ANNOTATION_LIMITS.context),
  })
  if (!result) throw new RangeError('Invalid annotation text selection.')
  return result
}

/** PDF.js adapters convert viewport rectangles with the actual crop box/viewport transform. */
export function projectPdfRectangle(rect: PdfAnnotationRect, rotation: 0 | 90 | 180 | 270) {
  const safe = rectangle(rect)
  if (!safe) throw new RangeError('Invalid annotation rectangle.')
  rect = safe
  switch (rotation) {
    case 0:
      return { ...rect }
    case 90:
      return { x: 1 - rect.y - rect.height, y: rect.x, width: rect.height, height: rect.width }
    case 180:
      return {
        x: 1 - rect.x - rect.width,
        y: 1 - rect.y - rect.height,
        width: rect.width,
        height: rect.height,
      }
    case 270:
      return { x: rect.y, y: 1 - rect.x - rect.width, width: rect.height, height: rect.width }
    default:
      throw new RangeError('Invalid annotation rotation.')
  }
}

export type AnchorResolution<T> =
  | { status: 'resolved'; value: T }
  | {
      status: 'unresolved'
      reason:
        | 'document-changed'
        | 'invalid-selector'
        | 'missing-content'
        | 'quote-mismatch'
        | 'ambiguous-quote'
        | 'resolution-limit'
    }
export interface ResolvedText {
  start: number
  end: number
  reanchored: boolean
}
function resolveText(selector: TextSelector, text: string): AnchorResolution<ResolvedText> {
  if (text.length > ANNOTATION_LIMITS.text)
    return { status: 'unresolved', reason: 'missing-content' }
  const matches = (start: number) =>
    text.slice(start, start + selector.exact.length) === selector.exact &&
    text.slice(Math.max(0, start - selector.prefix.length), start) === selector.prefix &&
    text.slice(
      start + selector.exact.length,
      start + selector.exact.length + selector.suffix.length,
    ) === selector.suffix
  if (matches(selector.start))
    return {
      status: 'resolved',
      value: { start: selector.start, end: selector.end, reanchored: false },
    }
  let found = -1
  let start = text.indexOf(selector.exact)
  let candidates = 0
  while (start !== -1) {
    if (++candidates > ANNOTATION_LIMITS.quoteCandidates)
      return { status: 'unresolved', reason: 'resolution-limit' }
    if (matches(start)) {
      if (found !== -1) return { status: 'unresolved', reason: 'ambiguous-quote' }
      found = start
    }
    start = text.indexOf(selector.exact, start + 1)
  }
  return found === -1
    ? { status: 'unresolved', reason: 'quote-mismatch' }
    : {
        status: 'resolved',
        value: { start: found, end: found + selector.exact.length, reanchored: true },
      }
}
function sameDocument(saved: AnnotationIdentity, current: AnnotationIdentity) {
  return (
    !!annotationIdentity(saved) &&
    !!annotationIdentity(current) &&
    saved.format === current.format &&
    saved.fingerprint === current.fingerprint
  )
}
export function resolvePdfAnnotation(
  saved: AnnotationIdentity,
  current: AnnotationIdentity,
  value: unknown,
  pages: ReadonlyMap<number, string>,
): AnchorResolution<(ResolvedText & { page: number; rectangles: PdfAnnotationRect[] })[]> {
  if (!sameDocument(saved, current)) return { status: 'unresolved', reason: 'document-changed' }
  const selector = normalizeAnnotationSelector(value)
  if (current.format !== 'PDF' || selector?.format !== 'PDF')
    return { status: 'unresolved', reason: 'invalid-selector' }
  const resolved: (ResolvedText & { page: number; rectangles: PdfAnnotationRect[] })[] = []
  for (const segment of selector.segments) {
    const text = pages.get(segment.page)
    if (text === undefined) return { status: 'unresolved', reason: 'missing-content' }
    const result = resolveText(segment.text, text)
    if (result.status === 'unresolved') return result
    // Reanchored text must get new geometry from the renderer, never reuse stale rectangles.
    resolved.push({
      page: segment.page,
      ...result.value,
      rectangles: result.value.reanchored ? [] : segment.rectangles,
    })
  }
  return { status: 'resolved', value: resolved }
}
export function resolveEpubAnnotation(
  saved: AnnotationIdentity,
  current: AnnotationIdentity,
  value: unknown,
  chapter: {
    index: number
    mode: 'formatted' | 'text'
    text: string
    cfiOffsets?: (cfi: string) => { start: number; end: number } | undefined
  },
): AnchorResolution<ResolvedText & { source: 'cfi' | 'text' }> {
  if (!sameDocument(saved, current)) return { status: 'unresolved', reason: 'document-changed' }
  const selector = normalizeAnnotationSelector(value)
  if (current.format !== 'EPUB' || selector?.format !== 'EPUB')
    return { status: 'unresolved', reason: 'invalid-selector' }
  if (chapter.index !== selector.chapter || chapter.text.length > ANNOTATION_LIMITS.text)
    return { status: 'unresolved', reason: 'missing-content' }
  const result = resolveText(selector.text, chapter.text)
  if (result.status === 'unresolved') return result
  if (selector.cfi && selector.mode === chapter.mode && chapter.cfiOffsets) {
    try {
      const candidate = chapter.cfiOffsets(selector.cfi)
      if (candidate?.start === result.value.start && candidate.end === result.value.end)
        return { status: 'resolved', value: { ...result.value, source: 'cfi' } }
    } catch {
      /* Invalid CFI falls back only to validated text. */
    }
  }
  return { status: 'resolved', value: { ...result.value, source: 'text' } }
}
