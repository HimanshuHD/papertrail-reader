/** A pointer hint only for freshly verified painted text; preserve authored attributes. */
export function bindHighlightHover(
  root: HTMLElement,
  rectangles: () => readonly (Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'> & {
    id?: string
  })[],
  onHover?: (id: string | null) => void,
) {
  let current: HTMLElement | null = null
  let cursor = '',
    priority = '',
    title: string | null = null
  function clear() {
    onHover?.(null)
    if (!current) return
    if (cursor) current.style.setProperty('cursor', cursor, priority)
    else current.style.removeProperty('cursor')
    if (title === null) current.removeAttribute('title')
    else current.setAttribute('title', title)
    current = null
  }
  function move(event: PointerEvent) {
    const target = event.target as HTMLElement | null
    const hit =
      target?.style &&
      root.contains(target) &&
      rectangles().find(
        (rect) =>
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom,
      )
    if (!hit) {
      clear()
      return
    }
    if (current === target) {
      onHover?.(hit.id ?? null)
      return
    }
    clear()
    onHover?.(hit.id ?? null)
    current = target
    cursor = target.style.getPropertyValue('cursor')
    priority = target.style.getPropertyPriority('cursor')
    title = target.getAttribute('title')
    target.style.setProperty('cursor', 'pointer', 'important')
    target.setAttribute('title', 'Show highlighted text')
  }
  root.addEventListener('pointermove', move)
  root.addEventListener('pointerleave', clear)
  return () => {
    clear()
    root.removeEventListener('pointermove', move)
    root.removeEventListener('pointerleave', clear)
  }
}
