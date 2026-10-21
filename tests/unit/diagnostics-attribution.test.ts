import { afterEach, expect, it, vi } from 'vitest'
import { DocumentSessions } from '../../src/features/reader/document-sessions'
import { diagnostics } from '../../src/features/diagnostics/recorder'
import { ReadingMetadataDatabase } from '../../src/services/reading-database'
import { IndexedDbReadingStorage } from '../../src/services/reading-storage'
import { IndexedDbEpubReadingStorage } from '../../src/services/epub-reading-storage'
import { IndexedDbBookmarkStorage } from '../../src/services/pdf-bookmarks'
import { IndexedDbWorkspaceStorage } from '../../src/services/workspace-storage'
import ResourcePanel from '../../src/features/diagnostics/ResourceInvestigation.vue'
import { mount } from '@vue/test-utils'

const evidence = () => diagnostics.investigation.snapshot({}, null)
const document = (format: 'PDF' | 'EPUB') => ({
  id: format,
  format,
  file: new File(['PRIVATE'], `SECRET.${format}`),
  name: `SECRET.${format}`,
  relativePath: 'PRIVATE',
  parentPath: '',
  source: 'file-input' as const,
})
afterEach(() => {
  diagnostics.pause()
  diagnostics.reset()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each(['PDF', 'EPUB'] as const)(
  'attributes %s cold open, warm dispatch and real retention expiry separately',
  async (format) => {
    vi.useFakeTimers()
    diagnostics.resume()
    const sessions = new DocumentSessions()
    await sessions.open(document(format))
    const first = sessions.active!
    await vi.advanceTimersByTimeAsync(25)
    sessions.update(first.session.id, first.generation, 'ready')
    const other = format === 'PDF' ? 'EPUB' : 'PDF'
    await sessions.open(document(other))
    const second = sessions.active!
    sessions.update(second.session.id, second.generation, 'ready')
    await sessions.activate(first.session.id)
    expect(evidence().timings.filter((r) => r.operation.endsWith('warm-activate'))).toHaveLength(1)
    // Selecting the same ready reader is a no-op, not another warm activation.
    await sessions.activate(first.session.id)
    await sessions.activate(second.session.id)
    await vi.advanceTimersByTimeAsync(299999)
    expect(sessions.retained.has(first.session.id)).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(sessions.retained.has(first.session.id)).toBe(false)
    await sessions.activate(first.session.id)
    const recreated = sessions.active!
    expect(recreated.generation).not.toBe(first.generation)
    expect(sessions.update(first.session.id, first.generation, 'error')).toBe(false)
    expect(evidence().pending[0]?.operation).toBe(`${format.toLowerCase()}.expired-open`)
    sessions.update(recreated.session.id, recreated.generation, 'ready')
    expect(
      evidence().timings.find((r) => r.operation === `${format.toLowerCase()}.cold-open`),
    ).toMatchObject({ outcome: 'completed', processingMs: 25 })
    expect(evidence().timings.at(-1)).toMatchObject({
      operation: `${format.toLowerCase()}.expired-open`,
      outcome: 'completed',
    })
    expect(JSON.stringify(evidence())).not.toMatch(/PRIVATE|SECRET|reader-session/)
    await sessions.reset()
    expect(vi.getTimerCount()).toBe(0)
  },
)

it('distinguishes restored workspace readers and prevents late completions after close, reset or pause', async () => {
  diagnostics.resume()
  const sessions = new DocumentSessions()
  const file = document('PDF')
  await sessions.open(file)
  let active = sessions.active!
  sessions.update(
    active.session.id,
    active.generation,
    'ready',
    `sha256-chunks-v1:${'a'.repeat(64)}`,
  )
  const saved = sessions.snapshot()
  sessions.restoreWorkspace(saved)
  expect(sessions.reconnect(active.session.id, file, `sha256-chunks-v1:${'a'.repeat(64)}`)).toBe(
    true,
  )
  await sessions.activate(active.session.id)
  active = sessions.active!
  expect(evidence().pending[0]?.operation).toBe('pdf.restored-open')
  await sessions.close(active.session.id)
  expect(evidence().timings.at(-1)?.outcome).toBe('cancelled')
  expect(sessions.update(active.session.id, active.generation, 'ready')).toBe(false)
  await sessions.open(document('EPUB'))
  active = sessions.active!
  diagnostics.reset()
  sessions.update(active.session.id, active.generation, 'ready')
  expect(evidence().timings).toHaveLength(0)
  await sessions.open(file)
  active = sessions.active!
  diagnostics.pause()
  diagnostics.resume()
  sessions.update(active.session.id, active.generation, 'ready')
  expect(evidence().timings).toHaveLength(0)
  await sessions.reset()
})

it('preserves failed and cancelled reader outcomes without private errors', async () => {
  diagnostics.resume()
  const sessions = new DocumentSessions()
  await sessions.open(document('PDF'))
  const active = sessions.active!
  sessions.update(active.session.id, active.generation, 'error')
  sessions.update(active.session.id, active.generation, 'error')
  expect(evidence().timings).toHaveLength(1)
  expect(evidence().timings[0]).toMatchObject({ outcome: 'failed', failure: 'other' })
  await sessions.open(document('EPUB'))
  await sessions.reset()
  expect(evidence().pending).toHaveLength(0)
  expect(evidence().timings.at(-1)?.outcome).toBe('cancelled')
})

it('labels logical reading intent at the actual persistence call sites', async () => {
  const transaction = vi
    .spyOn(ReadingMetadataDatabase.prototype, 'transaction')
    .mockResolvedValue(undefined)
  const pdf = new IndexedDbReadingStorage()
  await pdf.resolve('PRIVATE', 'SECRET')
  await pdf.save('PRIVATE', 2)
  const epub = new IndexedDbEpubReadingStorage()
  await epub.resolve('PRIVATE', 'SECRET')
  await epub.load('PRIVATE')
  await epub.save('PRIVATE', {
    textOnly: false,
    typography: { fontSize: 18, lineSpacing: 1.6, readingWidth: null },
  })
  const bookmarks = new IndexedDbBookmarkStorage()
  await bookmarks.load('PRIVATE')
  await bookmarks.remove('PRIVATE', 'SECRET')
  expect(transaction.mock.calls.map((call) => call[1])).toEqual([
    'reading.restore',
    'reading.write',
    'reading.restore',
    'reading.read',
    'reading.write',
    'reading.read',
    'reading.write',
  ])
})

it.each(['reading.read', 'reading.write', 'reading.restore'] as const)(
  'records %s through commit, not request success, and separates connection wait',
  async (operation) => {
    diagnostics.resume()
    let now = 10
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const request = {} as IDBOpenDBRequest
    const transaction = { objectStore: vi.fn(() => ({})) } as unknown as IDBTransaction
    const close = vi.fn()
    Object.assign(request, { result: { transaction: () => transaction, close } })
    vi.stubGlobal('indexedDB', { open: () => request })
    const promise = new ReadingMetadataDatabase().transaction(
      (_, result) => result('value'),
      operation,
    )
    let completed = false
    void promise.then(() => {
      completed = true
    })
    now = 20
    request.onsuccess?.(new Event('success'))
    await Promise.resolve()
    expect(completed).toBe(false)
    expect(evidence().pending[0]?.phase).toBe('processing')
    now = 40
    transaction.oncomplete?.(new Event('complete'))
    await expect(promise).resolves.toBe('value')
    expect(evidence().timings[0]).toMatchObject({
      operation,
      waitMs: 10,
      processingMs: 20,
      durationMs: 30,
    })
    expect(close).toHaveBeenCalledOnce()
  },
)

it('attributes workspace restore/write/clear through the same committed transaction boundary', async () => {
  diagnostics.resume()
  const request = {} as IDBOpenDBRequest
  const lookup = { result: undefined } as IDBRequest
  const put = vi.fn()
  const transaction = {
    objectStore: () => ({ get: () => lookup, put, delete: vi.fn() }),
  } as unknown as IDBTransaction
  Object.assign(request, { result: { transaction: () => transaction, close: vi.fn() } })
  vi.stubGlobal('indexedDB', { open: () => request })
  const storage = new IndexedDbWorkspaceStorage()
  const restored = storage.load()
  request.onsuccess?.(new Event('success'))
  await Promise.resolve()
  lookup.onsuccess?.(new Event('success'))
  transaction.oncomplete?.(new Event('complete'))
  await expect(restored).resolves.toBeNull()
  const written = storage.save({
    version: 1,
    source: 'file-input',
    label: 'SECRET',
    handle: null,
    documents: [],
    selectedPath: null,
    activePath: null,
    activeFingerprint: null,
    collapsedPaths: [],
    libraryScroll: 0,
    sidebarOpen: true,
    sidebarWidth: 308,
  })
  request.onsuccess?.(new Event('success'))
  await Promise.resolve()
  lookup.onsuccess?.(new Event('success'))
  expect(put).toHaveBeenCalledOnce()
  expect(evidence().timings).toHaveLength(1)
  transaction.oncomplete?.(new Event('complete'))
  await written
  const cleared = storage.clear()
  request.onsuccess?.(new Event('success'))
  await Promise.resolve()
  transaction.oncomplete?.(new Event('complete'))
  await cleared
  expect(evidence().timings.map((r) => r.operation)).toEqual([
    'workspace.restore',
    'workspace.write',
    'workspace.clear',
  ])
  expect(JSON.stringify(evidence())).not.toContain('SECRET')
})

it('renders readable attribution and explains warm dispatch versus readiness and logical restore', () => {
  diagnostics.resume()
  diagnostics.investigation.begin('epub.expired-open')?.finish()
  diagnostics.investigation.begin('reading.restore')?.finish()
  const wrapper = mount(ResourcePanel, { props: { snapshot: evidence(), selected: 'Requests' } })
  expect(wrapper.text()).toContain('EPUB reader recreation after expiry')
  expect(wrapper.text()).toContain('Reading metadata restore / resolve')
  expect(wrapper.text()).toContain('not paint or first-readable latency')
  expect(wrapper.text()).toContain('may create or migrate metadata')
  wrapper.unmount()
})
