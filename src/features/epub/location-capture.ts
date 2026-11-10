/** A session-owned scroll capture. Explicit reads can flush before lifecycle changes. */
export class EpubLocationCapture {
  private frame = 0
  private pending = false
  private epoch = 0

  constructor(private capture: () => void) {}

  schedule() {
    this.pending = true
    if (this.frame) return
    const epoch = this.epoch
    this.frame = requestAnimationFrame(() => {
      if (epoch !== this.epoch) return
      this.frame = 0
      this.flush()
    })
  }

  flush() {
    const pending = this.pending
    this.cancel()
    if (pending) this.capture()
  }

  cancel() {
    ++this.epoch
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.pending = false
  }
}
