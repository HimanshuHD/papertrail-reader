/** Yield only between preparation stages; a single DOM/ZIP operation remains synchronous. */
export class EpubPreparationWork {
  private lastYield = performance.now()
  constructor(private readonly ensureOpen: () => void) {}

  async checkpoint(force = false) {
    this.ensureOpen()
    // Scheduling heuristic, not a frame-time or document-size budget.
    if (!force && performance.now() - this.lastYield < 16) return
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    this.ensureOpen()
    this.lastYield = performance.now()
  }
}
