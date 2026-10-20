import {
  normalizeSessionState,
  normalizeWorkspaceTabs,
  sessionDocument,
  type WorkspaceTabs,
} from './session-snapshot'
import type { CachedLibraryDocument } from '../../services/workspace-storage'
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
  /** Transient layout only; never included in the persisted tab snapshot. */
  comparison: [string, string] | null = null
  comparisonCompact = true
  private remembered = new Map<string, CachedLibraryDocument>()
  private sources = new Map<string, DiscoveredDocument>()
  readonly retained = new Map<string, ActiveSession>()
  private runtimes = new Map<string, SessionRuntime>()
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private generation = 0
  private serial = 0

  constructor(private changed: () => void = () => {}) {}

  private nextId() {
    let id: string
    do {
      id = `reader-session-${++this.serial}`
    } while (this.sessions.has(id))
    return id
  }

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
    // Until restoration finishes, capture() can still report a default first page.
    if (session?.phase === 'ready' && runtime) {
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

  get visibleIds(): string[] {
    return this.comparison && !this.comparisonCompact
      ? [...this.comparison]
      : this.selectedId
        ? [this.selectedId]
        : []
  }

  canCompare(id: string): boolean {
    const session = this.sessions.get(id)
    return !!session?.fingerprint && session.phase !== 'closed' && this.sources.has(id)
  }

  private ensureReader(id: string) {
    if (this.retained.has(id)) return
    const session = this.sessions.get(id)
    if (!session || session.phase === 'closed') return
    const document = this.sources.get(id)
    if (!document) {
      session.phase = 'reconnect'
      return
    }
    session.phase = 'loading'
    this.retained.set(id, { session, document, generation: ++this.generation })
  }

  private syncVisibility() {
    const visible = new Set(this.visibleIds)
    for (const id of visible) this.ensureReader(id)
    this.active = this.retained.get(this.selectedId ?? '') ?? null
    for (const [id, owner] of this.retained) {
      if (visible.has(id)) {
        clearTimeout(this.timers.get(id))
        this.timers.delete(id)
      } else if (!this.timers.has(id)) {
        this.capture(id)
        this.timers.set(
          id,
          setTimeout(
            () => {
              if (this.visibleIds.includes(id) || this.retained.get(id) !== owner) return
              this.release(id)
              this.changed()
            },
            5 * 60 * 1000,
          ),
        )
      }
    }
  }

  compareWith(id: string): boolean {
    const current = this.selectedId
    if (!current || current === id || !this.canCompare(current) || !this.canCompare(id))
      return false
    this.comparison = [current, id]
    this.syncVisibility()
    this.changed()
    return true
  }

  endComparison() {
    if (!this.comparison) return
    this.comparison = null
    this.syncVisibility()
    this.changed()
  }

  swapComparison() {
    if (!this.comparison) return
    this.comparison = [this.comparison[1], this.comparison[0]]
    this.changed()
  }

  setComparisonCompact(compact: boolean) {
    if (this.comparisonCompact === compact) return
    this.comparisonCompact = compact
    if (this.comparison) {
      this.syncVisibility()
      this.changed()
    }
  }

  async open(document: DiscoveredDocument, initial?: Partial<SessionState>, fingerprint?: string) {
    const existing = [...this.sessions.values()].find(
      (s) =>
        s.phase !== 'closed' &&
        ((this.sources.get(s.id)?.file === document.file && s.sourceId === document.id) ||
          (Boolean(fingerprint) && s.fingerprint === fingerprint && s.format === document.format)),
    )
    const session = existing ?? {
      id: this.nextId(),
      sourceId: document.id,
      title: document.title || document.name,
      name: document.name,
      format: document.format,
      fingerprint: fingerprint ?? null,
      phase: 'suspended' as SessionPhase,
      state: normalizeSessionState(initial, document.format),
    }
    this.sessions.set(session.id, session)
    if (!existing || !this.sources.has(session.id)) {
      this.sources.set(session.id, document)
      this.remembered.set(session.id, sessionDocument(document))
      session.name = document.name
      session.title = document.title || document.name
      session.sourceId = document.id
    }
    return this.activate(session.id)
  }

  async activate(id: string) {
    const session = this.sessions.get(id)
    if (!session || session.phase === 'closed') return
    if (this.active?.session === session) return
    if (this.selectedId) this.capture(this.selectedId)
    if (this.comparison && !this.comparison.includes(id)) {
      const slot = this.comparison.indexOf(this.selectedId ?? '')
      this.comparison[slot === 1 ? 1 : 0] = id
    }
    this.selectedId = id
    this.syncVisibility()
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
    const paired = this.comparison?.includes(id)
      ? this.comparison.find((other) => other !== id)
      : undefined
    if (paired) this.comparison = null
    const selected = this.selectedId === id
    const next = selected
      ? (this.sessions.get(paired ?? '') ?? open[index + 1] ?? open[index - 1])
      : null
    this.release(id)
    session.phase = 'closed'
    this.sources.delete(id)
    this.remembered.delete(id)
    if (selected) this.selectedId = next?.id ?? null
    this.syncVisibility()
    this.changed()
  }

  async disconnect(id: string) {
    const session = this.sessions.get(id)
    if (!session || session.phase === 'closed') return
    this.release(id)
    this.sources.delete(id)
    session.phase = 'reconnect'
    this.changed()
  }

  /** Capture all warm readers, but persist only bounded, validated metadata. */
  snapshot(): WorkspaceTabs {
    const entries = [...this.sessions.values()].filter((session) => session.phase !== 'closed')
    for (const session of entries) this.capture(session.id)
    const snapshot = normalizeWorkspaceTabs({
      version: 1,
      activeId: this.selectedId,
      sessions: entries.map((session) => ({
        id: session.id,
        document: this.remembered.get(session.id),
        fingerprint: session.fingerprint,
        state: session.state,
      })),
    })
    if (!snapshot)
      throw new Error(
        'The tab workspace exceeds its saved metadata limits. Close some tabs before saving.',
      )
    return snapshot
  }

  /** Restore shells without starting readers or granting access to any file. */
  restoreWorkspace(value: unknown): boolean {
    const saved = normalizeWorkspaceTabs(value)
    if (!saved) return false
    ++this.generation
    this.comparison = null
    for (const id of [...this.retained.keys()]) this.release(id)
    this.sessions.clear()
    this.sources.clear()
    this.remembered.clear()
    for (const entry of saved.sessions) {
      this.sessions.set(entry.id, {
        id: entry.id,
        sourceId: entry.document.id,
        name: entry.document.name,
        title: entry.document.title || entry.document.name,
        format: entry.document.format,
        fingerprint: entry.fingerprint,
        phase: 'reconnect',
        state: entry.state,
      })
      this.remembered.set(entry.id, entry.document)
    }
    this.selectedId = saved.activeId
    this.changed()
    return true
  }

  /** Caller supplies a freshly verified fingerprint; filenames alone never rebind. */
  reconnect(id: string, document: DiscoveredDocument, fingerprint: string): boolean {
    const session = this.sessions.get(id)
    if (
      !session ||
      session.phase === 'closed' ||
      !session.fingerprint ||
      session.fingerprint !== fingerprint ||
      session.format !== document.format
    )
      return false
    this.release(id)
    this.sources.set(id, document)
    this.remembered.set(id, sessionDocument(document))
    session.sourceId = document.id
    session.name = document.name
    session.title = document.title || document.name
    session.phase = 'suspended'
    if (this.comparison?.includes(id)) this.syncVisibility()
    this.changed()
    return true
  }

  async reset() {
    ++this.generation
    this.comparison = null
    for (const id of [...this.retained.keys()]) this.release(id)
    for (const session of this.sessions.values()) session.phase = 'closed'
    this.selectedId = null
    this.sources.clear()
    this.remembered.clear()
    this.sessions.clear()
    this.changed()
  }
}
