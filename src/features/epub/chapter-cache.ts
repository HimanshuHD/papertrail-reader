export class ChapterCacheBudgetError extends Error {}
export interface PreparedChapter {
  markup: string
  warnings: readonly string[]
  fontWarnings?: readonly string[]
  bytes: number
  dispose(): void
}
/** One serialized builder, at most three retained chapters, one shared byte budget. */
export class ChapterCache {
  private entries = new Map<number, PreparedChapter>()
  private queue: Promise<unknown> = Promise.resolve()
  private running?: { index: number; background: boolean; controller: AbortController }
  private center = 0
  private active = -1
  private closed = false
  private epoch = 0
  constructor(
    private build:
      | ((index: number, signal: AbortSignal, budget: number) => Promise<PreparedChapter>)
      | undefined,
    private count: number,
    readonly budget = 96 * 1024 * 1024,
  ) {}
  private get bytes() {
    return [...this.entries.values()].reduce((sum, entry) => sum + entry.bytes, 0)
  }
  ready(index: number) {
    return this.entries.has(index)
  }
  get(index: number) {
    return this.entries.get(index)
  }
  current() {
    return this.entries.get(this.active)
  }
  focus(index: number) {
    this.center = index
    this.epoch++
    if (this.running?.background && this.running.index !== index) this.running.controller.abort()
    for (const key of this.entries.keys())
      if (Math.abs(key - index) > 1 && key !== this.active) this.evict(key)
  }
  private evict(index: number) {
    const entry = this.entries.get(index)
    this.entries.delete(index)
    entry?.dispose()
  }
  commit(index: number) {
    this.active = index
    for (const key of this.entries.keys()) if (Math.abs(key - this.center) > 1) this.evict(key)
  }
  prepare(index: number, background = false): Promise<PreparedChapter> {
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        if (this.closed) throw new DOMException('Chapter cache closed.', 'AbortError')
        if (index < 0 || index >= this.count || (background && Math.abs(index - this.center) > 1))
          throw new DOMException('Chapter preparation replaced.', 'AbortError')
        const cached = this.entries.get(index)
        if (cached) return cached
        if (!background) {
          for (const key of this.entries.keys()) {
            if (this.budget - this.bytes >= 36 * 1024 * 1024) break
            if (key !== this.active && key !== index) this.evict(key)
          }
        }
        const available = this.budget - this.bytes
        if (available < 4 * 1024 * 1024)
          throw new ChapterCacheBudgetError('Adjacent chapter cache is full.')
        const controller = new AbortController()
        this.running = { index, background, controller }
        try {
          const build = this.build
          if (!build) throw new DOMException('Chapter cache closed.', 'AbortError')
          const entry = await build(index, controller.signal, available)
          if (
            this.closed ||
            controller.signal.aborted ||
            (Math.abs(index - this.center) > 1 && index !== this.active)
          ) {
            entry.dispose()
            throw new DOMException('Chapter preparation replaced.', 'AbortError')
          }
          if (entry.bytes > available) {
            entry.dispose()
            throw new ChapterCacheBudgetError('Adjacent chapter cache is full.')
          }
          this.entries.set(index, entry)
          return entry
        } finally {
          this.running = undefined
        }
      })
    this.queue = task
    return task
  }
  async warm() {
    const epoch = this.epoch,
      center = this.center
    for (const index of [center + 1, center - 1]) {
      if (this.closed || epoch !== this.epoch) return
      if (index < 0 || index >= this.count) continue
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      if (this.closed || epoch !== this.epoch) return
      try {
        await this.prepare(index, true)
      } catch {
        /* Foreground retries surface errors; preload never replaces the active chapter. */
      }
    }
  }
  dispose() {
    this.closed = true
    this.epoch++
    this.running?.controller.abort()
    this.build = undefined
    this.queue = Promise.resolve()
    for (const index of this.entries.keys()) this.evict(index)
  }
}
