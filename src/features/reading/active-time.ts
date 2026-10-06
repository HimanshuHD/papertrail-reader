/** Foreground time is bounded by recent interaction, never inferred from wall-clock absence. */
export class ActiveReadingTime {
  static readonly idleMs = 60_000
  private last: number
  private activityAt: number
  private eligible = false
  activeMs = 0
  constructor(now: number) {
    this.last = this.activityAt = now
  }
  tick(now: number) {
    now = Math.max(this.last, now)
    if (this.eligible)
      this.activeMs += Math.max(
        0,
        Math.min(now, this.activityAt + ActiveReadingTime.idleMs) - this.last,
      )
    this.last = now
    return this.activeMs
  }
  setEligible(value: boolean, now: number) {
    this.tick(now)
    if (value && !this.eligible) this.activityAt = now
    this.eligible = value
  }
  activity(now: number) {
    this.tick(now)
    this.activityAt = now
  }
  isIdle(now: number) {
    return now >= this.activityAt + ActiveReadingTime.idleMs
  }
}
