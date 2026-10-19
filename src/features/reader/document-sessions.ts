import type { DiscoveredDocument } from '../library/discovery'
import type { PdfReadingState } from '../../services/pdf-reading-state'
import type { EpubReadingSettings } from '../../services/epub-reading-storage'

export type SessionPhase = 'loading' | 'ready' | 'suspended' | 'reconnect' | 'error' | 'closed'
export type UtilityPanel = 'contents' | 'search' | 'bookmarks' | 'annotations' | 'insights' | null
export interface SessionState {
  pdf?: PdfReadingState
  epub?: EpubReadingSettings
  panel: UtilityPanel
  query: string
}
export interface DocumentSession {
  id: string
  sourceId: string
  title: string
  name: string
  format: DiscoveredDocument['format']
  fingerprint: string | null
  phase: SessionPhase
  state: SessionState
}
export interface SessionRuntime {
  capture(): SessionState
  dispose(): Promise<void>
}
export interface ActiveSession {
  session: DocumentSession
  document: DiscoveredDocument
  generation: number
}

/** Local readers survive activation changes until five minutes of inactivity. */
export class DocumentSessions {
  readonly sessions = new Map<string, DocumentSession>()
  active: ActiveSession | null = null
  selectedId: string | null = null
  private sources = new Map<string, DiscoveredDocument>()
  readonly retained = new Map<string, ActiveSession>()
  private runtimes = new Map<string, SessionRuntime>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private generation = 0
  private serial = 0

  constructor(private changed: () => void = () => {}) {}

  owns(id: string, generation: number) {
    return this.active?.session.id === id && this.active.generation === generation
  }

  retainedOwns(id: string, generation: number) {
    return this.retained.get(id)?.generation === generation
  }

  attach(id: string, generation: number, runtime: SessionRuntime) {
    if (this.retainedOwns(id, generation)) this.runtimes.set(id, runtime)
    else this.disposeRuntime(runtime)
  }

  private capture(id: string) {
    const session = this.sessions.get(id),
      runtime = this.runtimes.get(id)
    if (session && runtime) {
      try {
        session.state = structuredClone(runtime.capture())
      } catch {
        /* Keep the last usable snapshot. */
      }
    }
  }

  private disposeRuntime(runtime: SessionRuntime) {
    // A failed or unfinished reader must never block unrelated activation/reset.
    void Promise.resolve()
      .then(() => runtime.dispose())
      .catch(() => {})
  }

  private release(id: string) {
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
    this.capture(id)
    const runtime = this.runtimes.get(id)
    this.runtimes.delete(id)
    this.retained.delete(id)
    if (this.active?.session.id === id) this.active = null
    const session = this.sessions.get(id)
    if (session && session.phase !== 'closed' && session.phase !== 'error')
      session.phase = 'suspended'
    if (runtime) this.disposeRuntime(runtime)
  }

  private suspend() {
    const previous = this.active
    if (!previous) return
    const id = previous.session.id
    this.capture(id)
    clearTimeout(this.timers.get(id))
    this.timers.set(
      id,
      setTimeout(
        () => {
          if (this.selectedId === id || this.retained.get(id) !== previous) return
          this.release(id)
          this.changed()
        },
        5 * 60 * 1000,
      ),
    )
    this.active = null
  }

  async open(document: DiscoveredDocument, initial?: Partial<SessionState>, fingerprint?: string) {
    const existing = [...this.sessions.values()].find(
      (s) =>
        s.phase !== 'closed' &&
        ((this.sources.get(s.id)?.file === document.file && s.sourceId === document.id) ||
          (Boolean(fingerprint) && s.fingerprint === fingerprint && s.format === document.format)),
    )
    const session = existing ?? {
      id: `reader-session-${++this.serial}`,
      sourceId: document.id,
      title: document.title || document.name,
      name: document.name,
      format: document.format,
      fingerprint: fingerprint ?? null,
      phase: 'suspended' as SessionPhase,
      state: { panel: initial?.panel ?? null, query: initial?.query ?? '' },
    }
    this.sessions.set(session.id, session)
    if (!existing || !this.sources.has(session.id)) {
      this.sources.set(session.id, document)
      session.sourceId = document.id
    }
    return this.activate(session.id)
  }

  async activate(id: string) {
    const session = this.sessions.get(id)
    if (!session || session.phase === 'closed') return
    if (this.active?.session === session) return
    this.suspend()
    this.selectedId = id
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
    const retained = this.retained.get(id)
    if (retained) {
      this.active = retained
      this.changed()
      return
    }
    const document = this.sources.get(id)
    if (!document) {
      session.phase = 'reconnect'
      this.changed()
      return
    }
    session.phase = 'loading'
    this.active = { session, document, generation: ++this.generation }
    this.retained.set(id, this.active)
    this.changed()
  }

  update(id: string, generation: number, phase: 'ready' | 'error', fingerprint?: string) {
    if (!this.retainedOwns(id, generation)) return false
    const session = this.retained.get(id)!.session
    session.phase = phase
    if (fingerprint) session.fingerprint = fingerprint
    this.changed()
    return true
  }

  async close(id: string) {
    const session = this.sessions.get(id)
    if (!session || session.phase === 'closed') return
    const open = [...this.sessions.values()].filter((item) => item.phase !== 'closed')
    const index = open.indexOf(session)
    const next = this.selectedId === id ? (open[index + 1] ?? open[index - 1]) : null
    const selected = this.selectedId === id
    this.release(id)
    session.phase = 'closed'
    this.sources.delete(id)
    this.changed()
    if (selected) {
      this.selectedId = next?.id ?? null
      if (next) await this.activate(next.id)
      else this.changed()
    }
  }

  async disconnect(id: string) {
    const session = this.sessions.get(id)
    if (!session || session.phase === 'closed') return
    this.release(id)
    this.sources.delete(id)
    session.phase = 'reconnect'
    this.changed()
  }

  async reset() {
    ++this.generation
    for (const id of [...this.retained.keys()]) this.release(id)
    for (const session of this.sessions.values()) session.phase = 'closed'
    this.selectedId = null
    this.sources.clear()
    this.sessions.clear()
    this.changed()
  }
}
