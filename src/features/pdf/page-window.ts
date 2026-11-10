/** Page components may disappear; measured dimensions and interaction ownership must not. */
export class PdfPageWindow {
  private nearby = new Set<number>()
  private retained = new Set<number>()
  private dragging = false

  proximity(page: number, near: boolean) {
    if (near) {
      this.nearby.add(page)
      if (this.dragging) this.retained.add(page)
    } else this.nearby.delete(page)
  }

  beginSelection() {
    this.dragging = true
    this.nearby.forEach((page) => this.retained.add(page))
  }

  selection(first?: number, last = first) {
    if (this.dragging) return
    this.retained.clear()
    if (first !== undefined && last !== undefined)
      for (let page = Math.min(first, last); page <= Math.max(first, last); page++)
        this.retained.add(page)
  }

  endSelection() {
    this.dragging = false
  }

  pages(target: number, focused?: number) {
    const pages = new Set([...this.nearby, ...this.retained, target])
    if (focused !== undefined) pages.add(focused)
    return pages
  }
}
