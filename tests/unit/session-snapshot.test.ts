import { afterEach, describe, expect, it, vi } from 'vitest'
import { DocumentSessions } from '../../src/features/reader/document-sessions'
import {
  MAX_SAVED_TABS,
  assertWorkspaceSchemaSupported,
  migrateWorkspaceTabs,
  normalizeWorkspaceTabs,
  normalizeSessionState,
  sessionDocument,
  UnsupportedWorkspaceSchemaError,
  type WorkspaceTabs,
} from '../../src/features/reader/session-snapshot'
import {
  IndexedDbWorkspaceStorage,
  validateWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from '../../src/services/workspace-storage'
import type { DiscoveredDocument } from '../../src/features/library/discovery'

const fingerprint = 'sha256-chunks-v1:' + 'a'.repeat(64)
const otherFingerprint = 'sha256-chunks-v1:' + 'b'.repeat(64)
function document(name = 'book.pdf', format: 'PDF' | 'EPUB' = 'PDF'): DiscoveredDocument {
  return {
    id: name,
    name,
    format,
    relativePath: name,
    parentPath: '',
    source: 'file-input',
    file: new File(['local book'], name, { lastModified: 123 }),
  }
}
function saved(): WorkspaceTabs {
  return {
    version: 1,
    activeId: 'reader-session-7',
    sessions: [
      {
        id: 'reader-session-7',
        document: sessionDocument(document()),
        fingerprint,
        state: {
          panel: 'bookmarks',
          query: 'local',
          pdf: {
            page: 3,
            view: { fitMode: 'custom', zoom: 2, twoPage: true },
            anchor: { page: 3, x: 0.2, y: 0.8 },
          },
        },
      },
    ],
  }
}
function workspace(): WorkspaceSnapshot {
  return {
    version: 1,
    source: 'file-input',
    label: 'Local files',
    handle: null,
    documents: [sessionDocument(document())],
    selectedPath: 'book.pdf',
    activePath: 'book.pdf',
    activeFingerprint: fingerprint,
    collapsedPaths: ['reference'],
    libraryScroll: 25,
    sidebarOpen: false,
    sidebarWidth: 350,
    utilityPanel: 'bookmarks',
    searchQuery: 'local',
  }
}
afterEach(() => vi.unstubAllGlobals())

describe('bounded workspace tab metadata', () => {
  it('whitelists state and identity without bytes, runtime objects or EPUB pagination', () => {
    const value = saved()
    Object.assign(value.sessions[0]!, {
      file: new File(['secret'], 'secret.pdf'),
      password: 'secret',
      runtime: {},
    })
    Object.assign(value.sessions[0]!.document, {
      file: new Blob(['secret']),
      objectURL: 'blob:secret',
    })
    Object.assign(value.sessions[0]!.state, { epub: { textOnly: true }, objectURL: 'blob:secret' })
    const clean = normalizeWorkspaceTabs(value)!
    expect(clean.sessions[0]!.state.pdf?.view.twoPage).toBe(true)
    expect(JSON.stringify(clean)).not.toMatch(/secret|objectURL|password|runtime|epub/)
    expect(clean.sessions[0]!.document).not.toHaveProperty('file')
    expect(normalizeSessionState({ epub: { twoPage: true, textOnly: true } }, 'EPUB')).toEqual({
      panel: null,
      query: '',
      epub: {
        textOnly: true,
        typography: { fontSize: null, lineSpacing: null, readingWidth: null },
      },
    })
  })
  it('preserves order/active choice and rejects duplicate, over-limit or unsafe metadata', () => {
    const first = saved().sessions[0]!
    const second = {
      ...first,
      id: 'reader-session-2',
      document: sessionDocument(document('other.epub', 'EPUB')),
    }
    expect(
      normalizeWorkspaceTabs({
        version: 1,
        activeId: first.id,
        sessions: [second, first],
      })?.sessions.map((s) => s.id),
    ).toEqual([second.id, first.id])
    for (const value of [
      { ...saved(), sessions: [first, first] },
      {
        ...saved(),
        sessions: Array.from({ length: MAX_SAVED_TABS + 1 }, (_, i) => ({
          ...first,
          id: `reader-session-${i + 1}`,
        })),
      },
      { ...saved(), sessions: [{ ...first, fingerprint: 'same filename' }] },
      {
        ...saved(),
        sessions: [{ ...first, document: { ...first.document, relativePath: '../book.pdf' } }],
      },
      { ...saved(), sessions: [{ ...first, id: 'unsafe" id' }] },
    ])
      expect(normalizeWorkspaceTabs(value)).toBeNull()
    expect(normalizeWorkspaceTabs({ ...saved(), activeId: 'missing' })?.activeId).toBe(first.id)
    expect(normalizeWorkspaceTabs(saved())).toEqual(saved())
  })
  it('migrates one v1 active document without overwriting separate reading databases or library context', () => {
    const previous = workspace()
    const tabs = migrateWorkspaceTabs(previous)
    expect(tabs.activeId).toBe('reader-session-1')
    expect(tabs.sessions[0]).toMatchObject({
      fingerprint,
      state: { panel: 'bookmarks', query: 'local' },
    })
    expect(tabs.sessions[0]!.state).not.toHaveProperty('pdf')
    expect(previous.sidebarWidth).toBe(350)
    expect(previous.collapsedPaths).toEqual(['reference'])
    expect(migrateWorkspaceTabs({ ...previous, activePath: null }).sessions).toEqual([])
    expect(
      migrateWorkspaceTabs({
        ...previous,
        documents: [...previous.documents, ...previous.documents],
      }).sessions,
    ).toEqual([])
    expect(validateWorkspaceSnapshot({ ...previous, tabs })?.tabs).toEqual(tabs)
    expect(
      validateWorkspaceSnapshot({ ...previous, tabs: { version: 1, sessions: ['malformed'] } }),
    ).toBeNull()
  })
  it('recognizes future top-level and nested schemas without treating corrupt data as newer', () => {
    for (const value of [{ version: 2 }, { version: 1, tabs: { version: 2 } }])
      expect(() => assertWorkspaceSchemaSupported(value)).toThrow(UnsupportedWorkspaceSchemaError)
    expect(() => assertWorkspaceSchemaSupported({ version: 'broken' })).not.toThrow()
  })
})

describe('reader shell restoration foundation', () => {
  it('restores only reconnect shells, verifies identity, and starts no inactive readers', async () => {
    const sessions = new DocumentSessions()
    const snapshot = saved()
    snapshot.sessions.push({
      ...snapshot.sessions[0]!,
      id: 'reader-session-1',
      fingerprint: otherFingerprint,
      document: sessionDocument(document('other.epub', 'EPUB')),
      state: { panel: null, query: '' },
    })
    expect(sessions.restoreWorkspace(snapshot)).toBe(true)
    expect(sessions.active).toBeNull()
    expect(sessions.retained.size).toBe(0)
    expect([...sessions.sessions.values()].map((s) => s.phase)).toEqual(['reconnect', 'reconnect'])
    expect(sessions.reconnect('reader-session-7', document(), otherFingerprint)).toBe(false)
    expect(
      sessions.reconnect('reader-session-7', document('wrong.epub', 'EPUB'), fingerprint),
    ).toBe(false)
    expect(sessions.reconnect('reader-session-7', document('renamed.pdf'), fingerprint)).toBe(true)
    expect(sessions.retained.size).toBe(0)
    await sessions.activate('reader-session-7')
    expect(sessions.active?.session.state.pdf?.page).toBe(3)
    expect(sessions.retained.size).toBe(1)
    await sessions.open(document('new.pdf'), undefined, 'sha256-chunks-v1:' + 'c'.repeat(64))
    expect(sessions.selectedId).not.toBe('reader-session-1')
    expect(sessions.sessions.size).toBe(3)
    await sessions.reset()
  })
  it('captures warm reading state, never resurrects closed tabs, and rejects invalid restore atomically', async () => {
    const sessions = new DocumentSessions()
    await sessions.open(document(), undefined, fingerprint)
    const owner = sessions.active!
    const dispose = vi.fn(async () => {})
    sessions.attach(owner.session.id, owner.generation, {
      capture: () => saved().sessions[0]!.state,
      dispose,
    })
    expect(sessions.snapshot().sessions[0]!.state.pdf?.page).toBe(3)
    expect(sessions.restoreWorkspace({ version: 2 })).toBe(false)
    expect(sessions.active).toBe(owner)
    await sessions.close(owner.session.id)
    expect(sessions.reconnect(owner.session.id, document(), fingerprint)).toBe(false)
    expect(sessions.snapshot().sessions).toEqual([])
    await Promise.resolve()
    expect(dispose).toHaveBeenCalledOnce()
    await sessions.reset()
  })
  it('preserves state and de-duplicates a verified explicit reselect after hydration', async () => {
    const sessions = new DocumentSessions()
    sessions.restoreWorkspace(saved())
    await sessions.open(document('renamed.pdf'), undefined, fingerprint)
    expect(sessions.active?.session.name).toBe('renamed.pdf')
    expect(sessions.sessions.size).toBe(1)
    expect(sessions.active?.session.state.pdf?.page).toBe(3)
    await sessions.reset()
  })
})

/** Minimal asynchronous IDB harness: validates transaction aborts and read/write ordering. */
function storage(initial: unknown) {
  let value = initial
  const puts = vi.fn((next: unknown) => {
    value = structuredClone(next)
  })
  const deletes = vi.fn(() => {
    value = undefined
  })
  const factory = {
    open: vi.fn(() => {
      const request: { result?: unknown; onsuccess?: () => void } = {}
      queueMicrotask(() => {
        request.result = {
          close: vi.fn(),
          transaction: () => {
            let aborted = false
            const transaction: {
              oncomplete?: () => void
              onabort?: () => void
              objectStore?: () => unknown
              abort?: () => void
            } = {}
            const complete = () =>
              queueMicrotask(() => {
                if (!aborted) transaction.oncomplete?.()
              })
            transaction.abort = () => {
              aborted = true
              queueMicrotask(() => transaction.onabort?.())
            }
            transaction.objectStore = () => ({
              get: () => {
                const read: { result?: unknown; onsuccess?: () => void } = {}
                queueMicrotask(() => {
                  read.result = value
                  read.onsuccess?.()
                  complete()
                })
                return read
              },
              put: (next: unknown) => {
                puts(next)
                complete()
              },
              delete: () => {
                deletes()
                complete()
              },
            })
            return transaction
          },
        }
        request.onsuccess?.()
      })
      return request
    }),
  }
  vi.stubGlobal('indexedDB', factory)
  return {
    repository: new IndexedDbWorkspaceStorage(),
    puts,
    deletes,
    value: () => value,
    replace: (next: unknown) => {
      value = next
    },
  }
}

it('preserves newer data on load and on later writes; only explicit clear removes it', async () => {
  const future = { ...workspace(), tabs: { version: 2, data: 'keep me' } }
  const db = storage(future)
  await expect(db.repository.load()).rejects.toThrow(UnsupportedWorkspaceSchemaError)
  await expect(db.repository.save(workspace())).rejects.toThrow(UnsupportedWorkspaceSchemaError)
  expect(db.puts).not.toHaveBeenCalled()
  expect(db.value()).toEqual(future)
  await db.repository.clear()
  expect(db.deletes).toHaveBeenCalledOnce()
  await db.repository.save({ ...workspace(), tabs: saved() })
  expect((await db.repository.load())?.tabs).toEqual(saved())
  db.replace({ version: 3, newer: true })
  await expect(db.repository.save(workspace())).rejects.toThrow(UnsupportedWorkspaceSchemaError)
  expect(db.puts).toHaveBeenCalledOnce()
})
