export interface PdfPageTracking {
  register(element: HTMLElement, page: number, proximity: (near: boolean) => void): () => void
  schedule(): void
}

export interface PdfViewportSample {
  bounds: DOMRect
  pages: { element: HTMLElement; page: number; box: DOMRect }[]
}

type Entry = { element: HTMLElement; page: number; proximity: (near: boolean) => void }
const margin = 700
const thresholds = [0, 0.1, 0.25, 0.5, 0.75, 1]

/** One tracker per workspace. Page shells stay mounted and keep their own bitmaps. */
export class PdfViewportTracker implements PdfPageTracking {
  private root: HTMLElement | null = null
  private entries: Entry[] = []
  private near = new Set<Entry>()
  private observers: IntersectionObserver[] = []
  private frame = 0
  private epoch = 0
  private disposed = false
  private columns = 1

  constructor(private updated: (sample: PdfViewportSample) => void = () => {}) {}

  get observerCount() {
    return this.observers.length
  }

  setRoot(root: HTMLElement | null) {
    if (this.disposed || root === this.root) return
    ++this.epoch
    this.observers.forEach((observer) => observer.disconnect())
    this.observers = []
    this.root = root
    if (root && typeof IntersectionObserver !== 'undefined') {
      const epoch = this.epoch
      const changed = () => {
        if (epoch === this.epoch) this.schedule()
      }
      this.observers = [
        new IntersectionObserver(changed, { root, rootMargin: '700px 0px', threshold: thresholds }),
        new IntersectionObserver(changed, { root, threshold: thresholds }),
      ]
      for (const entry of this.entries)
        this.observers.forEach((observer) => observer.observe(entry.element))
    }
    this.schedule()
  }

  setColumns(columns: 1 | 2) {
    this.columns = columns
    this.schedule()
  }

  register(element: HTMLElement, page: number, proximity: (near: boolean) => void) {
    if (this.disposed) return () => {}
    const entry = { element, page, proximity }
    // Mounts normally arrive in page order; replacement/out-of-order mounts still sort correctly.
    const index =
      (this.entries.at(-1)?.page ?? 0) <= page
        ? -1
        : this.entries.findIndex((item) => item.page > page)
    if (index < 0) this.entries.push(entry)
    else this.entries.splice(index, 0, entry)
    this.observers.forEach((observer) => observer.observe(element))
    this.schedule()
    return () => {
      const index = this.entries.indexOf(entry)
      if (index < 0) return
      this.entries.splice(index, 1)
      this.near.delete(entry)
      this.observers.forEach((observer) => observer.unobserve(element))
      this.schedule()
    }
  }

  schedule() {
    if (this.disposed || this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      const sample = this.measure()
      if (sample) this.updated(sample)
    })
  }

  /** Rows are ordered vertically, including unequal-height pages in two-page mode. */
  measure(): PdfViewportSample | null {
    const root = this.root
    if (this.disposed || !root) return null
    const bounds = root.getBoundingClientRect()
    const boxes = new Map<Entry, DOMRect>()
    const box = (entry: Entry) => {
      let value = boxes.get(entry)
      if (!value) {
        value = entry.element.getBoundingClientRect()
        boxes.set(entry, value)
      }
      return value
    }
    const rowCount = Math.ceil(this.entries.length / this.columns)
    const row = (index: number) =>
      this.entries.slice(index * this.columns, (index + 1) * this.columns)
    let low = 0
    let high = rowCount
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      const bottom = Math.max(...row(middle).map((entry) => box(entry).bottom))
      if (bottom < bounds.top - margin) low = middle + 1
      else high = middle
    }
    const next = new Set<Entry>()
    const pages: PdfViewportSample['pages'] = []
    for (let index = low; index < rowCount; index++) {
      const entries = row(index)
      if (Math.min(...entries.map((entry) => box(entry).top)) > bounds.bottom + margin) break
      for (const entry of entries) {
        const rectangle = box(entry)
        if (rectangle.bottom >= bounds.top - margin && rectangle.top <= bounds.bottom + margin) {
          next.add(entry)
          pages.push({ element: entry.element, page: entry.page, box: rectangle })
        }
      }
    }
    for (const entry of this.near) if (!next.has(entry)) entry.proximity(false)
    this.near = next
    // Revisit nearby dirty pages, but never dispatch a per-scroll callback to every page.
    for (const entry of next) entry.proximity(true)
    return { bounds, pages }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    ++this.epoch
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.observers.forEach((observer) => observer.disconnect())
    this.observers = []
    this.entries = []
    this.near.clear()
    this.root = null
  }
}
