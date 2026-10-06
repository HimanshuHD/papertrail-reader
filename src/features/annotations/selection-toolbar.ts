export interface SelectionAnchor {
  left: number
  top: number
}
/** Map native selection coordinates (including EPUB iframes) into the outer viewport. */
export function selectionAnchor(
  selection: Selection | null,
  frame?: HTMLIFrameElement | null,
): SelectionAnchor | null {
  if (!selection?.rangeCount || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  if (!range.getClientRects) return null
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)
  if (!rects.length) return null
  const first = rects[0]!
  const offset = frame?.getBoundingClientRect()
  return {
    left: first.left + first.width / 2 + (offset?.left ?? 0) + (frame?.clientLeft ?? 0),
    top: first.top + (offset?.top ?? 0) + (frame?.clientTop ?? 0),
  }
}
export function toolbarPosition(
  anchor: SelectionAnchor,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const margin = 8
  return {
    left: Math.max(margin, Math.min(anchor.left - width / 2, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(anchor.top - height - 10, viewportHeight - height - margin)),
  }
}
