/** A pointer hint only for freshly verified painted text; preserve authored attributes. */
export function bindHighlightHover(
  root: HTMLElement,
  rectangles: () => readonly (Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'> & {
    id?: string
  })[],
  onHover?: (id: string | null) => void,
  active: () => boolean = () => true,
) {
  let current: HTMLElement | null = null
  let cursor = '',
    priority = '',
    title: string | null = null
  let frame = 0
  let epoch = 0
  let disposed = false
  let pending: { target: HTMLElement; x: number; y: number } | null = null
  function clear() {
    ++epoch
    cancelAnimationFrame(frame)
    frame = 0
    pending = null
    onHover?.(null)
    if (!current) return
    if (cursor) current.style.setProperty('cursor', cursor, priority)
    else current.style.removeProperty('cursor')
    if (title === null) current.removeAttribute('title')
    else current.setAttribute('title', title)
    current = null
  }
  function process() {
    const point = pending
    pending = null
    // Geometry is deliberately fresh each frame, including after scroll/reflow/repaint.
    const target = point?.target
    const hit =
      point &&
      active() &&
      target?.style &&
      root.contains(target) &&
      rectangles().find(
        (rect) =>
          point.x >= rect.left &&
          point.x <= rect.right &&
          point.y >= rect.top &&
          point.y <= rect.bottom,
      )
    if (!hit || !target) {
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
  function move(event: PointerEvent) {
    if (disposed || !active()) return
    pending = { target: event.target as HTMLElement, x: event.clientX, y: event.clientY }
    if (frame) return
    const owner = epoch
    frame = requestAnimationFrame(() => {
      if (disposed || owner !== epoch) return
      frame = 0
      process()
    })
  }
  root.addEventListener('pointermove', move)
  root.addEventListener('pointerleave', clear)
  root.addEventListener('pointercancel', clear)
  return Object.assign(
    () => {
      if (disposed) return
      disposed = true
      clear()
      root.removeEventListener('pointermove', move)
      root.removeEventListener('pointerleave', clear)
      root.removeEventListener('pointercancel', clear)
    },
    { clear },
  )
}
