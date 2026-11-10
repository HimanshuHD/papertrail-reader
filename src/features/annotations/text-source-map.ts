export interface SourcePosition {
  part: number
  offset: number
}

/** Numeric source runs only; DOM ownership stays with the caller's node table. */
export class TextSourceMap {
  constructor(
    readonly length: number,
    private readonly starts: Uint32Array,
    private readonly parts: Int32Array,
    private readonly offsets: Uint32Array,
  ) {}
  get spanCount() {
    return this.starts.length
  }
  get storageBytes() {
    return this.starts.byteLength + this.parts.byteLength + this.offsets.byteLength
  }
  at(index: number): SourcePosition | null | undefined {
    if (!Number.isInteger(index) || index < 0 || index >= this.length) return undefined
    let low = 0,
      high = this.starts.length
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2)
      if (this.starts[middle]! <= index) low = middle
      else high = middle
    }
    const part = this.parts[low]!
    return part < 0 ? null : { part, offset: this.offsets[low]! + index - this.starts[low]! }
  }
  /** Canonical envelope of selected source intervals, preserving collapsed-space semantics. */
  bounds(
    selected: ReadonlyMap<number, { start: number; end: number }>,
  ): [number, number] | undefined {
    let first = Infinity,
      last = -1
    for (let span = 0; span < this.starts.length; span++) {
      const part = this.parts[span]!
      if (part < 0) continue
      const interval = selected.get(part)
      if (!interval) continue
      const from = this.starts[span]!,
        to = this.starts[span + 1] ?? this.length
      const source = this.offsets[span]!
      const start = Math.max(source, interval.start),
        end = Math.min(source + to - from, interval.end)
      if (start >= end) continue
      first = Math.min(first, from + start - source)
      last = Math.max(last, from + end - source)
    }
    return last < 0 ? undefined : [first, last]
  }
}

/** Amortized linear construction without allocating a position object for each UTF-16 unit. */
export class TextSourceMapBuilder {
  private starts = new Uint32Array(0)
  private parts = new Int32Array(0)
  private offsets = new Uint32Array(0)
  private count = 0
  private length = 0
  append(part: number | null, offset = 0) {
    const key = part ?? -1,
      previous = this.count - 1
    if (
      previous < 0 ||
      this.parts[previous] !== key ||
      this.offsets[previous]! + this.length - this.starts[previous]! !== offset
    ) {
      if (this.count === this.starts.length) {
        const capacity = Math.max(16, this.count * 2)
        const starts = new Uint32Array(capacity),
          parts = new Int32Array(capacity),
          offsets = new Uint32Array(capacity)
        starts.set(this.starts)
        parts.set(this.parts)
        offsets.set(this.offsets)
        this.starts = starts
        this.parts = parts
        this.offsets = offsets
      }
      this.starts[this.count] = this.length
      this.parts[this.count] = key
      this.offsets[this.count++] = offset
    }
    this.length++
  }
  trimLast() {
    if (!this.length) return
    this.length--
    if (this.starts[this.count - 1] === this.length) this.count--
  }
  finish() {
    return new TextSourceMap(
      this.length,
      this.starts.slice(0, this.count),
      this.parts.slice(0, this.count),
      this.offsets.slice(0, this.count),
    )
  }
}
