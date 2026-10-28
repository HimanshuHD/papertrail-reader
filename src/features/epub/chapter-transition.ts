import type Rendition from 'epubjs/types/rendition'
interface View {
  element: HTMLElement
  displayed: boolean
  destroy(): void
}
interface Manager {
  views: { _views: View[]; length: number; clear(): void }
  clear(): void
  createView(...args: unknown[]): View
  display(...args: unknown[]): Promise<unknown>
}
/** Keep the old iframe painted while epub.js loads its replacement. Never move a live iframe. */
export function keepChapterPainted(rendition: Rendition): () => void {
  const manager = (rendition as unknown as { manager?: Manager }).manager
  if (!manager?.views || !manager.createView) return () => {}
  const originalDisplay = manager.display,
    originalCreate = manager.createView
  let closed = false
  const parked = new Set<View>()
  let pendingClear: (() => void) | undefined
  manager.display = async function (...args) {
    if (closed) throw new DOMException('Reader closed.', 'AbortError')
    const previous = [...this.views._views]
    for (const view of previous) parked.add(view)
    this.views._views = []
    this.views.length = 0
    const clear = this.clear
    pendingClear = clear
    this.clear = () => {}
    this.createView = (...options) => {
      const view = originalCreate.apply(this, options)
      view.element.style.position = 'absolute'
      view.element.style.inset = '0'
      view.element.style.visibility = 'hidden'
      view.element.setAttribute('aria-hidden', 'true')
      view.element.setAttribute('inert', '')
      return view
    }
    try {
      await originalDisplay.apply(this, args)
      if (closed) throw new DOMException('Reader closed.', 'AbortError')
      for (const view of previous) {
        parked.delete(view)
        view.destroy()
        view.element.remove()
      }
      for (const view of this.views._views) {
        view.element.style.position = 'relative'
        view.element.style.removeProperty('inset')
        view.element.removeAttribute('aria-hidden')
        view.element.removeAttribute('inert')
      }
    } catch (error) {
      if (!closed) {
        this.views.clear()
        this.views._views = previous
        this.views.length = previous.length
        for (const view of previous) parked.delete(view)
      }
      throw error
    } finally {
      this.clear = clear
      pendingClear = undefined
      this.createView = originalCreate
    }
  }
  return () => {
    closed = true
    if (pendingClear) manager.clear = pendingClear
    for (const view of parked) {
      view.destroy()
      view.element.remove()
    }
    parked.clear()
    manager.display = originalDisplay
    manager.createView = originalCreate
  }
}
