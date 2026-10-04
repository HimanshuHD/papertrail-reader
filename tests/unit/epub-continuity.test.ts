import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useEpubContinuity } from '../../src/composables/useEpubContinuity'
import { useEpubBookmarks } from '../../src/composables/useEpubBookmarks'
import {
  IndexedDbEpubReadingStorage,
  normalizeEpubRecord,
  normalizeEpubSettings,
  normalizeEpubBookmarks,
  fingerprintEpub,
  type EpubReadingStorage,
  type EpubReadingRecord,
} from '../../src/services/epub-reading-storage'
import { ReadingMetadataDatabase } from '../../src/services/reading-database'
import type { EpubLocation } from '../../src/features/epub/location'

vi.mock('../../src/services/document-identity', () => ({
  fingerprintDocument: vi.fn(
    async (file: File) =>
      'sha256-chunks-v1:' + (file.name.includes('changed') ? 'b' : 'a').repeat(64),
  ),
}))
const fingerprint = 'sha256-chunks-v1:' + 'a'.repeat(64)
const location: EpubLocation = {
  version: 1,
  chapter: 1,
  mode: 'formatted',
  kind: 'text',
  cfi: null,
  node: 'pt-4',
  character: 30,
  quote: 'reading',
  offset: -4,
  ratio: 0.3,
  atEnd: false,
}
const settings = {
  location,
  textOnly: true,
  typography: { fontSize: 22, lineSpacing: 1.8, readingWidth: 640 },
}
const record: EpubReadingRecord = {
  version: 1,
  format: 'EPUB',
  id: 'epub:A',
  fingerprint,
  name: 'A.epub',
  updatedAt: 1,
  bookmarks: [],
  ...settings,
}
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  vi.useRealTimers()
})

/** Implements transactional ownership, not a browser/IndexedDB compatibility claim. */
class MemoryDatabase extends ReadingMetadataDatabase {
  records = new Map<string, unknown>()
  writes = Promise.resolve()
  override transaction<T>(
    run: (store: IDBObjectStore, done: (value: T) => void) => void,
  ): Promise<T> {
    const task = this.writes.then(
      () =>
        new Promise<T>((resolve, reject) => {
          const staged = new Map(this.records)
          const request = (result: unknown) => {
            const request = { result, onsuccess: null as (() => void) | null }
            queueMicrotask(() => request.onsuccess?.())
            return request
          }
          const store = {
            get: (id: string) => request(staged.get(id)),
            index: () => ({
              getAll: (digest: string) =>
                request(
                  [...staged.values()].filter(
                    (v) => (v as EpubReadingRecord).fingerprint === digest,
                  ),
                ),
            }),
            put: (v: EpubReadingRecord) => staged.set(v.id, structuredClone(v)),
            add: (v: EpubReadingRecord) => staged.set(v.id, structuredClone(v)),
            transaction: { abort: () => reject(Error('aborted')) },
          }
          run(store as unknown as IDBObjectStore, (value) => {
            this.records = staged
            resolve(value)
          })
        }),
    )
    this.writes = task.then(
      () => undefined,
      () => undefined,
    )
    return task
  }
}
function setup(storage: EpubReadingStorage, capture = () => settings) {
  let state!: ReturnType<typeof useEpubContinuity>
  wrappers.push(
    mount({
      setup() {
        state = useEpubContinuity(capture, storage)
        return () => null
      },
    }),
  )
  return state
}
it('reuses content identity after rename, isolates changed bytes and rejects oversized hashing', async () => {
  const database = new MemoryDatabase()
  const storage = new IndexedDbEpubReadingStorage(database)
  const a = await storage.resolve(await fingerprintEpub(new File(['book'], 'A.epub')), 'A.epub')
  await storage.save(a.record.id, settings)
  const renamed = await storage.resolve(
    await fingerprintEpub(new File(['book'], 'renamed.epub')),
    'renamed.epub',
  )
  expect(renamed.record.id).toBe(a.record.id)
  expect(renamed.record.location).toEqual(location)
  const changed = await storage.resolve(
    await fingerprintEpub(new File(['new'], 'changed.epub')),
    'changed.epub',
  )
  expect(changed.record.id).not.toBe(a.record.id)
  expect(changed.record.location).toBeUndefined()
  await expect(fingerprintEpub({ size: 128 * 1024 * 1024 + 1 } as File)).rejects.toThrow(
    'size limit',
  )
})
it('normalizes metadata, strips bytes and isolates future or ambiguous records', async () => {
  expect(
    normalizeEpubSettings({
      ...settings,
      location: { ...location, chapter: -1 },
      typography: { fontSize: 999, readingWidth: '<img>' },
    }),
  ).toEqual({
    textOnly: true,
    typography: { fontSize: null, lineSpacing: null, readingWidth: null },
  })
  expect(normalizeEpubRecord({ ...record, bytes: new Blob(['book']) })).toEqual(record)
  expect(normalizeEpubRecord({ ...record, format: 'PDF' })).toBeUndefined()
  expect(normalizeEpubRecord({ ...record, version: 2 })).toBeUndefined()
  const database = new MemoryDatabase()
  database.records.set(record.id, { ...record, version: 2 })
  const storage = new IndexedDbEpubReadingStorage(database)
  expect((await storage.resolve(fingerprint, 'A')).ambiguous).toBe(true)
  expect(database.records.get(record.id)).toMatchObject({ version: 2 })
  database.records.set('epub:B', { ...record, id: 'epub:B' })
  expect((await storage.resolve(fingerprint, 'A')).ambiguous).toBe(true)
})
it('keeps bookmarks and position saves atomic, and never resurrects cleared metadata', async () => {
  const database = new MemoryDatabase()
  database.records.set(record.id, record)
  const storage = new IndexedDbEpubReadingStorage(database)
  const [bookmarks] = await Promise.all([
    storage.add(record.id, ' Chapter ', location),
    storage.save(record.id, { ...settings, location: { ...location, character: 31 } }),
  ])
  expect((await storage.load(record.id))[0]?.name).toBe('Chapter')
  expect((await storage.resolve(fingerprint, 'A')).record.location?.character).toBe(31)
  expect(
    normalizeEpubBookmarks([
      bookmarks[0],
      bookmarks[0],
      { ...bookmarks[0], id: 'bad', location: { ...location, ratio: 2 } },
    ]),
  ).toHaveLength(1)
  await storage.rename(record.id, bookmarks[0]!.id, 'New label')
  expect((await storage.load(record.id))[0]?.name).toBe('New label')
  await storage.remove(record.id, bookmarks[0]!.id)
  expect(await storage.load(record.id)).toEqual([])
  database.records.clear()
  await expect(storage.save(record.id, settings)).rejects.toThrow()
  await expect(storage.add(record.id, 'No resurrection', location)).rejects.toThrow()
  expect(database.records.size).toBe(0)
})
it('flushes the latest reading point on document switch, page exit and unmount before restoration', async () => {
  vi.useFakeTimers()
  const database = new MemoryDatabase()
  const storage = new IndexedDbEpubReadingStorage(database)
  const state = setup(storage)
  await state.prepare(new File([], 'A.epub'))
  state.save()
  await state.prepare(new File([], 'changed.epub'))
  expect((await storage.resolve(fingerprint, 'renamed.epub')).record.location).toEqual(location)
  state.save()
  globalThis.dispatchEvent(new Event('pagehide'))
  await flushPromises()
  const reloaded = setup(storage)
  expect(await reloaded.prepare(new File([], 'changed.epub'))).toEqual(settings)
  wrappers.pop()!.unmount()
  await flushPromises()
  expect(state.documentId.value).not.toBeNull()
})
it('ignores stale identity resolution and keeps reading usable on quota failures', async () => {
  const database = new MemoryDatabase()
  const storage = new IndexedDbEpubReadingStorage(database)
  let finish!: (value: { record: EpubReadingRecord; ambiguous: boolean }) => void
  vi.spyOn(storage, 'resolve').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const state = setup(storage)
  const pending = state.prepare(new File([], 'A.epub'))
  await flushPromises()
  await state.prepare(new File([], 'changed.epub'))
  finish({ record, ambiguous: false })
  expect(await pending).toBeNull()
  expect(state.fingerprint.value).toBe('sha256-chunks-v1:' + 'b'.repeat(64))
  vi.spyOn(storage, 'save').mockRejectedValueOnce(Error('quota'))
  state.save()
  state.flush()
  await flushPromises()
  expect(state.notice.value).toContain('continue reading')
  vi.spyOn(storage, 'resolve').mockRejectedValueOnce(Error('blocked'))
  expect(await state.prepare(new File([], 'A.epub'))).toBeNull()
  expect(state.documentId.value).toBeNull()
  expect(state.fingerprint.value).toBe(fingerprint)
  expect(state.notice.value).toContain('unavailable')
})
it('does not publish late bookmark mutations after switching identities', async () => {
  const database = new MemoryDatabase()
  database.records.set(record.id, record)
  const storage = new IndexedDbEpubReadingStorage(database)
  const id = ref<string | null>(record.id)
  let marks!: ReturnType<typeof useEpubBookmarks>
  wrappers.push(
    mount({
      setup() {
        marks = useEpubBookmarks(id, storage)
        return () => null
      },
    }),
  )
  await flushPromises()
  let finish!: (value: Awaited<ReturnType<EpubReadingStorage['add']>>) => void
  vi.spyOn(storage, 'add').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const pending = marks.add('A only', location)
  await flushPromises()
  expect(await marks.add('Duplicate', location)).toBe(false)
  id.value = null
  finish([{ id: 'mark', name: 'A only', location, createdAt: 1 }])
  expect(await pending).toBe(false)
  expect(marks.bookmarks.value).toEqual([])
})
