import { diagnostics } from './recorder'

export type RegistrationKind = 'ownedListeners' | 'ownedObservers' | 'ownedTimers'
/** Explicit registrations at instrumented owners, never patched browser APIs. */
export class OwnedRegistrations {
  private closed = false
  private counts = { ownedListeners: 0, ownedObservers: 0, ownedTimers: 0 }
  set(kind: RegistrationKind, count: number) {
    if (this.closed) return
    this.counts[kind] = Math.max(0, Math.floor(count))
    diagnostics.resources(this, { ...this.counts })
  }
  dispose() {
    this.closed = true
    diagnostics.release(this)
  }
}
