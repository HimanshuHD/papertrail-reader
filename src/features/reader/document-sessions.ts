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

/** Serializable records are separate from local access and the single live runtime. */
export class DocumentSessions {
  readonly sessions = new Map<string, DocumentSession>()
  active: ActiveSession | null = null
  selectedId: string | null = null
  private sources = new Map<string, DiscoveredDocument>()
  private runtime: SessionRuntime | null = null
  private generation = 0
  private serial = 0
  private cleanup = Promise.resolve()

  constructor(private changed: () => void = () => {}) {}

  owns(id: string, generation: number) {
    return this.active?.session.id === id && this.active.generation === generation
  }

  attach(id: string, generation: number, runtime: SessionRuntime) {
    if (this.owns(id, generation)) this.runtime = runtime
    else void runtime.dispose()
  }

  private release() {
    const previous = this.active
    const runtime = this.runtime
    this.runtime = null
    this.active = null
    if (previous) {
      if (runtime) previous.session.state = structuredClone(runtime.capture())
      if (previous.session.phase !== 'error') previous.session.phase = 'suspended'
    }
    // Start cancellation synchronously; wait for disposal before mounting another viewer.
    if (runtime) {
      const disposal = runtime.dispose()
      this.cleanup = Promise.all([this.cleanup, disposal]).then(() => {})
    }
    this.changed()
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
    this.selectedId = id
    const owner = ++this.generation
    this.release()
    await this.cleanup
    if (owner !== this.generation || this.sessions.get(id)?.phase === 'closed') return
    const document = this.sources.get(id)
    if (!document) {
      session.phase = 'reconnect'
      this.changed()
      return
    }
    session.phase = 'loading'
    this.active = { session, document, generation: owner }
    this.changed()
  }

  update(id: string, generation: number, phase: 'ready' | 'error', fingerprint?: string) {
    if (!this.owns(id, generation)) return false
    const session = this.active!.session
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
    if (this.active?.session === session) {
      ++this.generation
      this.release()
    }
    session.phase = 'closed'
    this.sources.delete(id)
    this.changed()
    if (selected) {
      this.selectedId = next?.id ?? null
      if (next) await this.activate(next.id)
      else this.changed()
    }
    await this.cleanup
  }

  async disconnect(id: string) {
    const session = this.sessions.get(id)
    if (!session || session.phase === 'closed') return
    if (this.active?.session === session) {
      ++this.generation
      this.release()
    }
    this.sources.delete(id)
    session.phase = 'reconnect'
    this.changed()
    await this.cleanup
  }

  async reset() {
    ++this.generation
    this.release()
    for (const session of this.sessions.values()) session.phase = 'closed'
    this.selectedId = null
    this.sources.clear()
    this.sessions.clear()
    this.changed()
    await this.cleanup
  }
}
