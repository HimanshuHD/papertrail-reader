/** Locations are local to one validated publication; persistence/identity belongs to #133. */
export interface EpubLocation {
  version: 1
  chapter: number
  kind: 'text' | 'element'
  mode: 'formatted' | 'text'
  cfi: string | null
  node: string
  character: number
  quote: string
  offset: number
  ratio: number
  atEnd: boolean
}
export interface CfiBridge {
  cfiBase: string
  cfiFromRange(range: Range): string
  range(cfi: string): Range
}
const nodePattern = /^pt-\d{1,6}$/u
export function normalizeLocation(value: unknown, chapters: number): EpubLocation | undefined {
  if (!value || typeof value !== 'object') return
  const v = value as Partial<EpubLocation>
  if (
    v.version !== 1 ||
    !Number.isInteger(v.chapter) ||
    v.chapter! < 0 ||
    v.chapter! >= chapters ||
    !['text', 'element'].includes(v.kind ?? '') ||
    !['formatted', 'text'].includes(v.mode ?? '') ||
    typeof v.node !== 'string' ||
    !nodePattern.test(v.node) ||
    !Number.isInteger(v.character) ||
    v.character! < 0 ||
    v.character! > 8388608 ||
    typeof v.quote !== 'string' ||
    v.quote.length > 64 ||
    !Number.isFinite(v.offset) ||
    Math.abs(v.offset!) > 100000 ||
    !Number.isFinite(v.ratio) ||
    v.ratio! < 0 ||
    v.ratio! > 1 ||
    typeof v.atEnd !== 'boolean'
  )
    return
  const cfi =
    typeof v.cfi === 'string' && v.cfi.length <= 2048 && /^epubcfi\([^\s<>]+\)$/u.test(v.cfi)
      ? v.cfi
      : null
  return {
    version: 1,
    chapter: v.chapter!,
    kind: v.kind as EpubLocation['kind'],
    mode: v.mode as EpubLocation['mode'],
    cfi,
    node: v.node,
    character: v.character!,
    quote: v.quote,
    offset: v.offset!,
    ratio: v.ratio!,
    atEnd: v.atEnd,
  }
}
function textNodes(element: Element): Text[] {
  const walker = element.ownerDocument.createTreeWalker(element, 4)
  const nodes: Text[] = []
  let next: Node | null
  let inspected = 0
  while ((next = walker.nextNode()) && ++inspected <= 20000) {
    if (!next.parentElement?.closest('[data-reader-image]')) nodes.push(next as Text)
  }
  return nodes
}
function characterRange(text: Text, offset: number): Range {
  const range = text.ownerDocument.createRange()
  range.setStart(text, Math.min(offset, text.length))
  range.setEnd(text, Math.min(offset + 1, text.length))
  return range
}
function textRange(element: Element, character: number): Range | undefined {
  const texts = textNodes(element)
  let remaining = character
  for (const text of texts) {
    if (remaining < text.length) return characterRange(text, remaining)
    remaining -= text.length
  }
}
function rangeRect(range: Range): DOMRect | undefined {
  if (!range.getBoundingClientRect) return
  const rect = range.getBoundingClientRect()
  return rect.height || rect.width ? rect : undefined
}
function visibleRange(
  doc: Document,
  iframe: HTMLIFrameElement,
  container: HTMLElement,
): Range | undefined {
  const bounds = container.getBoundingClientRect()
  const frame = iframe.getBoundingClientRect()
  const top = bounds.top - frame.top
  const bottom = bounds.bottom - frame.top
  const x = Math.max(0, Math.min(frame.width - 1, doc.body?.dir === 'rtl' ? frame.width - 32 : 32))
  const caret = doc.caretRangeFromPoint?.(x, Math.max(0, top + 8))
  if (
    caret?.startContainer.nodeType === 3 &&
    caret.startContainer.parentElement?.closest('[data-reader-node]') &&
    !caret.startContainer.parentElement?.closest('[data-reader-image]')
  ) {
    const result = characterRange(caret.startContainer as Text, caret.startOffset)
    const rect = rangeRect(result)
    if (rect && rect.bottom > top && rect.top < bottom) return result
  }
  // Cross-browser fallback: binary search the first visible character of bounded text nodes.
  for (const text of textNodes(doc.body)) {
    if (!text.length || !text.data.trim()) continue
    const whole = doc.createRange()
    whole.selectNodeContents(text)
    const rect = rangeRect(whole)
    if (!rect || rect.bottom <= top || rect.top >= bottom) continue
    let low = 0
    let high = text.length - 1
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      const box = rangeRect(characterRange(text, mid))
      if (!box) break
      if (box.bottom <= top) low = mid + 1
      else high = mid
    }
    return characterRange(text, low)
  }
}
export function captureLocation(
  root: HTMLElement,
  chapter: number,
  mode: EpubLocation['mode'],
  bridge?: CfiBridge,
): EpubLocation | undefined {
  const container = root.querySelector<HTMLElement>('.epub-container')
  const iframe = root.querySelector('iframe')
  const doc = iframe?.contentDocument
  if (!container || !iframe || !doc?.body) return
  const viewport = container.getBoundingClientRect()
  const frameTop = iframe.getBoundingClientRect().top
  const range = visibleRange(doc, iframe, container)
  const parent = range?.startContainer.parentElement?.closest('[data-reader-node]')
  const element =
    parent ??
    [...doc.querySelectorAll('[data-reader-node]')].slice(0, 20000).find((el) => {
      const rect = el.getBoundingClientRect()
      return rect.bottom + frameTop > viewport.top && rect.top + frameTop < viewport.bottom
    })
  const node = element?.getAttribute('data-reader-node')
  if (!element || !node || !nodePattern.test(node)) return
  let character = 0
  let quote = ''
  let cfi: string | null = null
  if (range) {
    const texts = textNodes(element)
    for (const text of texts) {
      if (text === range.startContainer) {
        character += range.startOffset
        break
      }
      character += text.length
    }
    quote = texts
      .map((text) => text.data)
      .join('')
      .slice(character, character + 32)
    try {
      cfi = bridge?.cfiFromRange(range) ?? null
    } catch {
      /* Validated text anchor remains available. */
    }
  }
  const maximum = Math.max(0, container.scrollHeight - container.clientHeight)
  const rect = range && rangeRect(range)
  return {
    version: 1,
    chapter,
    kind: range ? 'text' : 'element',
    mode,
    cfi,
    node,
    character,
    quote,
    offset: (rect ?? element.getBoundingClientRect()).top + frameTop - viewport.top,
    ratio: maximum ? Math.max(0, Math.min(1, container.scrollTop / maximum)) : 0,
    atEnd: maximum > 0 && container.scrollTop >= maximum - 2,
  }
}
export function restoreLocation(
  root: HTMLElement,
  location: EpubLocation,
  mode: EpubLocation['mode'],
  bridge?: CfiBridge,
): boolean {
  const container = root.querySelector<HTMLElement>('.epub-container')
  const iframe = root.querySelector('iframe')
  const doc = iframe?.contentDocument
  if (!container || !iframe || !doc?.body) return false
  const element = doc.querySelector(`[data-reader-node="${location.node}"]`)
  if (!element) return false
  let range: Range | undefined
  if (
    location.kind === 'text' &&
    location.mode === mode &&
    bridge &&
    location.cfi?.startsWith(`epubcfi(${bridge.cfiBase}!`)
  ) {
    try {
      const candidate = bridge.range(location.cfi)
      if (
        candidate.startContainer.ownerDocument === doc &&
        doc.body.contains(candidate.startContainer) &&
        candidate.startContainer.parentElement?.closest('[data-reader-node]') === element
      ) {
        let offset = candidate.startOffset
        for (const text of textNodes(element)) {
          if (text === candidate.startContainer) break
          offset += text.length
        }
        if (offset === location.character) range = candidate
      }
    } catch {
      /* Rebuilt DOMs can differ; use their stable source text IDs. */
    }
  }
  const texts = textNodes(element)
  const text = texts.map((node) => node.data).join('')
  if (
    location.quote &&
    text.slice(location.character, location.character + location.quote.length) !== location.quote
  )
    return false
  if (text && location.character >= text.length) return false
  if (location.kind === 'text') range ??= textRange(element, location.character)
  const rect = range && rangeRect(range)
  const maximum = Math.max(0, container.scrollHeight - container.clientHeight)
  const top = location.atEnd
    ? maximum
    : container.scrollTop +
      (rect ?? element.getBoundingClientRect()).top +
      iframe.getBoundingClientRect().top -
      container.getBoundingClientRect().top -
      (location.kind === 'element' && location.mode !== mode
        ? Math.max(location.offset, -Math.max(0, element.getBoundingClientRect().height - 1))
        : location.offset)
  container.scrollTop = Math.max(0, Math.min(maximum, top))
  container.scrollLeft = 0
  return true
}
