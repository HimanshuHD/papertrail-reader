function cancelled() {
  const error = new Error('PDF rendering cancelled.')
  error.name = 'RenderingCancelledException'
  return error
}

/** Session-local admission; a slot covers pending pixels through display commit. */
export class PdfRenderSlots {
  private active = 0
  private closed = false
  private readonly entries = new Map<
    object,
    {
      cancelled: boolean
      started: boolean
      resolve: (release: () => void) => void
      reject: (error: Error) => void
    }
  >()
  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Invalid PDF render limit.')
  }
  acquire(owner: object): Promise<() => void> {
    if (this.closed) return Promise.reject(cancelled())
    if (this.entries.has(owner)) return Promise.reject(new Error('PDF render already reserved.'))
    return new Promise((resolve, reject) => {
      this.entries.set(owner, { cancelled: false, started: false, resolve, reject })
      this.drain()
    })
  }
  private drain() {
    if (this.closed) return
    for (const [owner, entry] of this.entries) {
      if (this.active >= this.limit) break
      if (entry.started) continue
      entry.started = true
      this.active++
      let released = false
      entry.resolve(() => {
        if (released) return
        released = true
        this.entries.delete(owner)
        this.active--
        this.drain()
      })
    }
  }
  isCancelled(owner: object) {
    return this.entries.get(owner)?.cancelled ?? false
  }
  cancel(owner: object) {
    const entry = this.entries.get(owner)
    if (!entry) return
    entry.cancelled = true
    // Active owners retain their slot until their finally block releases the backing.
    if (!entry.started) {
      this.entries.delete(owner)
      entry.reject(cancelled())
    }
  }
  close() {
    this.closed = true
    for (const owner of this.entries.keys()) this.cancel(owner)
  }
}
