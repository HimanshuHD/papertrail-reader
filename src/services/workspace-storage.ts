import type { DiscoveredDocument, LibraryDocumentMetadata } from '../features/library/discovery'
import type { BrowserLibrarySelection } from '../features/library/browser-selection'

export interface CachedLibraryDocument extends LibraryDocumentMetadata {
  size: number
  lastModified: number
}
export interface WorkspaceSnapshot {
  version: 1
  source: BrowserLibrarySelection['source']
  label: string
  handle: FileSystemDirectoryHandle | null
  documents: CachedLibraryDocument[]
  selectedPath: string | null
  activePath: string | null
  activeFingerprint: string | null
  collapsedPaths: string[]
  libraryScroll: number
  sidebarOpen: boolean
  sidebarWidth: number
  utilityPanel?: 'contents' | 'search' | 'bookmarks' | 'annotations' | null
  searchQuery?: string
}
export interface WorkspaceStorage {
  load(): Promise<WorkspaceSnapshot | null>
  save(snapshot: WorkspaceSnapshot): Promise<void>
  clear(): Promise<void>
}

export function cacheLibraryDocuments(
  documents: readonly DiscoveredDocument[],
): CachedLibraryDocument[] {
  return documents.map(({ id, name, title, format, relativePath, parentPath, source, file }) => ({
    id,
    name,
    title,
    format,
    relativePath,
    parentPath,
    source,
    size: file.size,
    lastModified: file.lastModified,
  }))
}

function validateSnapshot(value: unknown): WorkspaceSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const state = value as WorkspaceSnapshot
  if (
    state.version !== 1 ||
    !Array.isArray(state.documents) ||
    !Array.isArray(state.collapsedPaths)
  )
    return null
  if (
    !['directory-picker', 'directory-input', 'file-input'].includes(state.source) ||
    typeof state.label !== 'string'
  )
    return null
  if (
    state.documents.some(
      (item) =>
        !item ||
        typeof item.relativePath !== 'string' ||
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.parentPath !== 'string' ||
        !['PDF', 'EPUB'].includes(item.format) ||
        !['directory-picker', 'directory-input', 'file-input'].includes(item.source) ||
        !Number.isFinite(item.size) ||
        item.size < 0 ||
        !Number.isFinite(item.lastModified),
    )
  )
    return null
  return {
    version: 1,
    source: state.source,
    label: state.label,
    handle:
      state.source === 'directory-picker' && state.handle?.kind === 'directory'
        ? state.handle
        : null,
    documents: state.documents.map(
      ({ id, name, title, format, relativePath, parentPath, source, size, lastModified }) => ({
        id,
        name,
        title: typeof title === 'string' ? title : undefined,
        format,
        relativePath,
        parentPath,
        source,
        size,
        lastModified,
      }),
    ),
    utilityPanel:
      state.utilityPanel === 'contents' ||
      state.utilityPanel === 'search' ||
      state.utilityPanel === 'bookmarks' ||
      state.utilityPanel === 'annotations'
        ? state.utilityPanel
        : null,
    searchQuery: typeof state.searchQuery === 'string' ? state.searchQuery.slice(0, 500) : '',
    selectedPath: typeof state.selectedPath === 'string' ? state.selectedPath : null,
    activePath: typeof state.activePath === 'string' ? state.activePath : null,
    activeFingerprint: typeof state.activeFingerprint === 'string' ? state.activeFingerprint : null,
    collapsedPaths: state.collapsedPaths.filter((path) => typeof path === 'string'),
    libraryScroll: Number.isFinite(state.libraryScroll) ? Math.max(0, state.libraryScroll) : 0,
    sidebarWidth: Number.isFinite(state.sidebarWidth)
      ? Math.min(600, Math.max(160, state.sidebarWidth))
      : 308,
    sidebarOpen: state.sidebarOpen !== false,
  }
}

/** Stores metadata and permission-bearing handles, never File/Blob document bytes. */
export class IndexedDbWorkspaceStorage implements WorkspaceStorage {
  constructor(private readonly databaseName = 'papertrail-workspace') {}
  private async transaction<T>(
    run: (store: IDBObjectStore, result: (value: T) => void) => void,
  ): Promise<T> {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error('Workspace storage unavailable.'))
      const request = indexedDB.open(this.databaseName, 1)
      let blocked = false
      request.onupgradeneeded = () => request.result.createObjectStore('workspace')
      request.onblocked = () => {
        blocked = true
        reject(new Error('Workspace storage blocked.'))
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        if (blocked) request.result.close()
        else resolve(request.result)
      }
    })
    try {
      return await new Promise<T>((resolve, reject) => {
        const transaction = database.transaction('workspace', 'readwrite')
        let result: T
        transaction.oncomplete = () => resolve(result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('Workspace transaction aborted.'))
        try {
          run(transaction.objectStore('workspace'), (value) => {
            result = value
          })
        } catch (error) {
          transaction.abort()
          reject(error)
        }
      })
    } finally {
      database.close()
    }
  }
  load(): Promise<WorkspaceSnapshot | null> {
    return this.transaction((store, done) => {
      const request = store.get('current')
      request.onsuccess = () => done(validateSnapshot(request.result))
    })
  }
  save(snapshot: WorkspaceSnapshot): Promise<void> {
    return this.transaction((store, done) => {
      const safe = validateSnapshot(snapshot)
      if (!safe) throw new Error('Invalid workspace metadata.')
      store.put(safe, 'current')
      done(undefined)
    })
  }
  clear(): Promise<void> {
    return this.transaction((store, done) => {
      store.delete('current')
      done(undefined)
    })
  }
}
