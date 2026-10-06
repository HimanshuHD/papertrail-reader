/** Align the first visible highlight line inside the reading pane, below its controls. */
export const HIGHLIGHT_TOP_OFFSET = 24

export function scrollHighlightRange(
  container: HTMLElement,
  range: Range,
  frame?: HTMLIFrameElement,
): boolean {
  if (
    frame
      ? !container.contains(frame) ||
        frame.contentDocument !== range.startContainer.ownerDocument ||
        frame.contentDocument !== range.endContainer.ownerDocument
      : !container.contains(range.startContainer) || !container.contains(range.endContainer)
  )
    return false
  if (typeof range.getClientRects !== 'function') return false
  const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
  if (!rects.length) return false
  const top = Math.min(...rects.map((rect) => rect.top))
  const frameTop = frame ? frame.getBoundingClientRect().top + frame.clientTop : 0
  const viewportTop = container.getBoundingClientRect().top + container.clientTop
  const target = container.scrollTop + frameTop + top - viewportTop - HIGHLIGHT_TOP_OFFSET
  if (!Number.isFinite(target)) return false
  container.scrollTop = Math.max(
    0,
    Math.min(target, Math.max(0, container.scrollHeight - container.clientHeight)),
  )
  return true
}
