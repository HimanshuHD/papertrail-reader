import type { AnnotationColor } from '../../services/annotation-storage'
export const SELECTION_COLORS: Record<AnnotationColor, string> = {
  yellow: '#fde68a80',
  green: '#bbf7d080',
  blue: '#bfdbfe80',
  pink: '#fbcfe880',
}
/** Owned chapter stylesheet; no wrappers or document-content changes. */
export function selectionColorPreview(doc: Document, color: AnnotationColor) {
  const style = doc.createElement('style')
  doc.head.append(style)
  function set(next: AnnotationColor) {
    style.textContent = `::selection { background: ${SELECTION_COLORS[next].slice(0, 7)} !important; color: #173449 !important; }`
  }
  set(color)
  return { set, dispose: () => style.remove() }
}
