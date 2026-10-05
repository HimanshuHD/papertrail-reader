import type Rendition from 'epubjs/types/rendition'

// epub.js 0.3.93's default manager clears every view in resize(). Its scrolled
// chapter can instead update the existing view's width/layout without reloading.
// Keep this version-specific bridge isolated from publication and UI services.
interface ScrollView {
  size(width: number, height: number): void
}
interface ScrollManager {
  container: HTMLElement
  stage: { settings: { width: number; height: number }; size(width: number, height: number): void }
  layout: { calculate(width: number, height: number): void }
  viewSettings: { width: number; height: number }
  views: { forEach(callback: (view: ScrollView) => void): void }
  setLayout(layout: ScrollManager['layout']): void
  bounds(): DOMRect
  _bounds: DOMRect
  resize(width?: number, height?: number): void
}

export function keepScrolledChapterMounted(
  rendition: Rendition,
  root: HTMLElement,
  anchor?: { capture(): unknown; restore(saved: unknown): void },
): () => void {
  const manager = (rendition as unknown as { manager: ScrollManager }).manager
  const originalResize = manager.resize
  manager.container.style.setProperty('overflow-x', 'hidden', 'important')
  manager.container.style.setProperty('overflow-y', 'auto', 'important')
  manager.container.style.scrollbarGutter = 'stable'
  // The location service owns anchoring; native anchoring can add a second
  // line-sized correction after an iframe expands during reflow.
  manager.container.style.overflowAnchor = 'none'
  manager.resize = (width = root.clientWidth, height = root.clientHeight) => {
    if (!width || !height) return
    const saved = anchor?.capture()
    const iframe = root.querySelector('iframe')
    const doc = iframe?.contentDocument
    const frameBounds = iframe?.getBoundingClientRect()
    const viewport = manager.container.getBoundingClientRect()
    // Retain the visible text rather than recreating the chapter at its start.
    const caret =
      !anchor &&
      doc &&
      frameBounds &&
      doc.caretRangeFromPoint?.(
        Math.min(32, frameBounds.width / 2),
        Math.max(0, viewport.top - frameBounds.top) + 8,
      )
    const before = caret ? caret.getBoundingClientRect().top : undefined
    manager.stage.settings.width = width
    manager.stage.settings.height = height
    manager.stage.size(width, height)
    const contentWidth = manager.container.clientWidth
    const contentHeight = manager.container.clientHeight
    manager._bounds = manager.bounds()
    manager.viewSettings.width = contentWidth
    manager.viewSettings.height = contentHeight
    manager.views.forEach((view) => view.size(contentWidth, contentHeight))
    manager.layout.calculate(contentWidth, contentHeight)
    manager.setLayout(manager.layout)
    if (anchor) anchor.restore(saved)
    if (caret && before !== undefined) {
      manager.container.scrollTop += caret.getBoundingClientRect().top - before
    }
  }
  return () => {
    manager.resize = originalResize
  }
}
