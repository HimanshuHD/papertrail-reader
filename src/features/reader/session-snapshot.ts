import type { DiscoveredDocument } from '../library/discovery'
import type { CachedLibraryDocument, WorkspaceSnapshot } from '../../services/workspace-storage'
import { normalizePdfAnchor, normalizePdfView } from '../../services/pdf-reading-state'
import { normalizeEpubSettings } from '../../services/epub-reading-storage'
import type { SessionState, UtilityPanel } from './document-sessions'

export const MAX_SAVED_TABS = 128
export interface SavedDocumentSession {
  id: string
  document: CachedLibraryDocument
  fingerprint: string | null
  state: SessionState
}
export interface WorkspaceTabs {
  version: 1
  sessions: SavedDocumentSession[]
  activeId: string | null
}
const panels = new Set(['contents', 'search', 'bookmarks', 'annotations', 'insights'])
const fingerprintPattern = /^sha256-chunks-v1:[a-f0-9]{64}$/u
const sessionIdPattern = /^reader-session-[1-9]\d{0,8}$/u
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
const label = (value: unknown, maximum = 4096): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= maximum &&
  Array.from(value).every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)

/** Explicit allowlists keep file bytes, instances and unknown fields out of storage. */
export function normalizeSessionState(value: unknown, format: 'PDF' | 'EPUB'): SessionState {
  const state = object(value)
  const result: SessionState = {
    panel: panels.has(String(state?.panel)) ? (state!.panel as UtilityPanel) : null,
    query: typeof state?.query === 'string' ? state.query.slice(0, 500) : '',
  }
  const pdf = object(state?.pdf)
  if (format === 'PDF' && pdf) {
    const savedAnchor = object(pdf.anchor)
    const anchor =
      savedAnchor &&
      typeof savedAnchor.page === 'number' &&
      typeof savedAnchor.x === 'number' &&
      typeof savedAnchor.y === 'number'
        ? normalizePdfAnchor({ page: savedAnchor.page, x: savedAnchor.x, y: savedAnchor.y })
        : undefined
    result.pdf = {
      page: Number.isSafeInteger(pdf.page) && Number(pdf.page) > 0 ? Number(pdf.page) : 1,
      view: normalizePdfView(object(pdf.view) ?? {}),
      ...(anchor ? { anchor } : {}),
    }
  }
  if (format === 'EPUB' && object(state?.epub)) result.epub = normalizeEpubSettings(state!.epub)
  return result
}

export function normalizeSessionDocument(value: unknown): CachedLibraryDocument | null {
  const item = object(value)
  if (
    !item ||
    !label(item.id) ||
    !label(item.name) ||
    !label(item.relativePath) ||
    typeof item.parentPath !== 'string' ||
    item.parentPath.length > 4096 ||
    !['PDF', 'EPUB'].includes(String(item.format)) ||
    !['directory-picker', 'directory-input', 'file-input'].includes(String(item.source)) ||
    !Number.isSafeInteger(item.size) ||
    Number(item.size) < 0 ||
    !Number.isSafeInteger(item.lastModified) ||
    Number(item.lastModified) < 0
  )
    return null
  if (
    item.relativePath.startsWith('/') ||
    item.relativePath.split('/').some((part) => part === '..')
  )
    return null
  return {
    id: item.id,
    name: item.name,
    relativePath: item.relativePath,
    parentPath: item.parentPath,
    ...(label(item.title, 1000) ? { title: item.title } : {}),
    format: item.format as CachedLibraryDocument['format'],
    source: item.source as CachedLibraryDocument['source'],
    size: Number(item.size),
    lastModified: Number(item.lastModified),
  }
}

export function sessionDocument(document: DiscoveredDocument): CachedLibraryDocument {
  const { file, ...metadata } = document
  return { ...metadata, size: file.size, lastModified: file.lastModified }
}

/** Invalid lists are rejected whole rather than silently losing or reordering tabs. */
export function normalizeWorkspaceTabs(value: unknown): WorkspaceTabs | null {
  const state = object(value)
  if (
    !state ||
    state.version !== 1 ||
    !Array.isArray(state.sessions) ||
    state.sessions.length > MAX_SAVED_TABS
  )
    return null
  const sessions: SavedDocumentSession[] = []
  const ids = new Set<string>()
  for (const value of state.sessions) {
    const entry = object(value)
    if (
      !entry ||
      typeof entry.id !== 'string' ||
      !sessionIdPattern.test(entry.id) ||
      ids.has(entry.id)
    )
      return null
    const document = normalizeSessionDocument(entry.document)
    if (
      !document ||
      (entry.fingerprint !== null &&
        (typeof entry.fingerprint !== 'string' || !fingerprintPattern.test(entry.fingerprint)))
    )
      return null
    ids.add(entry.id)
    sessions.push({
      id: entry.id,
      document,
      fingerprint: entry.fingerprint as string | null,
      state: normalizeSessionState(entry.state, document.format),
    })
  }
  return {
    version: 1,
    sessions,
    activeId:
      typeof state.activeId === 'string' && ids.has(state.activeId)
        ? state.activeId
        : (sessions[0]?.id ?? null),
  }
}

/** Existing document reading databases remain authoritative when v1 has no tab state. */
export function migrateWorkspaceTabs(saved: WorkspaceSnapshot): WorkspaceTabs {
  if (saved.tabs) return saved.tabs
  const matches = saved.documents.filter((item) => item.relativePath === saved.activePath)
  const document = matches.length === 1 ? normalizeSessionDocument(matches[0]) : null
  if (!document) return { version: 1, sessions: [], activeId: null }
  return {
    version: 1,
    activeId: 'reader-session-1',
    sessions: [
      {
        id: 'reader-session-1',
        document,
        fingerprint:
          typeof saved.activeFingerprint === 'string' &&
          fingerprintPattern.test(saved.activeFingerprint)
            ? saved.activeFingerprint
            : null,
        state: normalizeSessionState(
          { panel: saved.utilityPanel, query: saved.searchQuery },
          document.format,
        ),
      },
    ],
  }
}

export class UnsupportedWorkspaceSchemaError extends Error {
  constructor() {
    super(
      'Saved workspace uses a newer format. Use Forget library to reset it, or open it with a newer app version.',
    )
  }
}
export function assertWorkspaceSchemaSupported(value: unknown) {
  const state = object(value)
  if (!state) return
  const tabs = object(state.tabs)
  if (
    (typeof state.version === 'number' && state.version > 1) ||
    (typeof tabs?.version === 'number' && tabs.version > 1)
  )
    throw new UnsupportedWorkspaceSchemaError()
}
