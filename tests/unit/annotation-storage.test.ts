import { expect, it, vi } from 'vitest'
import { ReadingMetadataDatabase } from '../../src/services/reading-database'
import {
  IndexedDbAnnotationStorage,
  migrateAnnotationDocument,
  type AnnotationDocument,
} from '../../src/services/annotation-storage'
import {
  captureTextSelector,
  type AnnotationIdentity,
  type AnnotationSelector,
} from '../../src/features/annotations/selectors'

const identity: AnnotationIdentity = {
  format: 'PDF',
  fingerprint: 'sha256-chunks-v1:' + 'a'.repeat(64),
}
const id = `${identity.format}:${identity.fingerprint}`
const selector: AnnotationSelector = {
  version: 1,
  format: 'PDF',
  segments: [
    {
      page: 1,
      text: captureTextSelector('A quiet reading space', 2, 7),
      rectangles: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
    },
  ],
}
const legacy = {
  version: 1,
  id,
  ...identity,
  annotations: [{ version: 1, id: 'legacy-highlight', selector, color: 'yellow', createdAt: 1 }],
}

/** Serialized, commit/rollback-aware seam; not evidence of native browser compatibility. */
class TransactionDatabase extends ReadingMetadataDatabase {
  records = new Map<string, unknown>()
  nextFailure: unknown
  private writes = Promise.resolve()
  override transaction<T>(
    run: (store: IDBObjectStore, done: (value: T) => void) => void,
  ): Promise<T> {
    const task = this.writes.then(
      () =>
        new Promise<T>((resolve, reject) => {
          const staged = new Map(this.records)
          let aborted = false
          const store = {
            get: (key: string) => {
              const request = {
                result: structuredClone(staged.get(key)),
                onsuccess: null as (() => void) | null,
              }
              queueMicrotask(() => {
                if (!aborted) request.onsuccess?.()
              })
              return request
            },
            put: (record: AnnotationDocument) => staged.set(record.id, structuredClone(record)),
            delete: (key: string) => staged.delete(key),
            transaction: {
              abort: () => {
                aborted = true
                reject(Error('aborted'))
              },
            },
          }
          run(store as unknown as IDBObjectStore, (result) => {
            // Completion can fail after requests succeed; never expose an uncommitted result.
            queueMicrotask(() => {
              if (aborted) return
              if (this.nextFailure) {
                const error = this.nextFailure
                this.nextFailure = undefined
                reject(error)
                return
              }
              this.records = staged
              resolve(result)
            })
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
function setup() {
  const database = new TransactionDatabase()
  return { database, storage: new IndexedDbAnnotationStorage(database) }
}

it('supports CRUD and reload while preserving plain-text notes and ignoring foreign fields', async () => {
  const { database, storage } = setup()
  const { handle } = await storage.open(identity)
  const created = await storage.create(handle, {
    ...selector,
    bytes: new Blob(['book']),
  } as AnnotationSelector)
  const note = '<img src=x onerror=alert(1)> plain text'
  await storage.update(handle, created.id, { note, color: 'blue', selector: null } as {
    note: string
    color: 'blue'
  })
  const reload = await new IndexedDbAnnotationStorage(database).open(identity)
  expect(reload.handle).toEqual(handle)
  expect(reload.annotations).toMatchObject([{ id: created.id, note, color: 'blue', selector }])
  expect(Object.keys(database.records.get(id) as object).sort()).toEqual([
    'annotations',
    'fingerprint',
    'format',
    'generation',
    'id',
    'version',
  ])
  expect(JSON.stringify([...database.records.values()])).not.toContain('bytes')
  reload.annotations[0]!.note = 'changed externally'
  expect((await storage.list(handle))[0]!.note).toBe(note)
  await storage.remove(handle, created.id)
  expect(await storage.list(handle)).toEqual([])
  await expect(storage.update(handle, created.id, { note: 'missing' })).rejects.toMatchObject({
    reason: 'missing-annotation',
  })
})
it('serializes independent creations and note/color edits without losing changes', async () => {
  const { storage } = setup()
  const { handle } = await storage.open(identity)
  const annotations = await Promise.all([
    storage.create(handle, selector),
    storage.create(handle, selector, 'green'),
  ])
  await Promise.all([
    storage.update(handle, annotations[0]!.id, { note: 'note' }),
    storage.update(handle, annotations[0]!.id, { color: 'pink' }),
  ])
  expect(await storage.list(handle)).toMatchObject([
    { note: 'note', color: 'pink' },
    { color: 'green' },
  ])
})
it('reuses content identity and isolates changed bytes and different formats', async () => {
  const { storage } = setup()
  const first = await storage.open(identity)
  await storage.create(first.handle, selector)
  expect((await storage.open(identity)).annotations).toHaveLength(1)
  expect(
    (await storage.open({ ...identity, fingerprint: 'sha256-chunks-v1:' + 'b'.repeat(64) }))
      .annotations,
  ).toEqual([])
  const epub = await storage.open({ ...identity, format: 'EPUB' })
  expect(epub.annotations).toEqual([])
  await expect(storage.create(epub.handle, selector)).rejects.toMatchObject({
    reason: 'invalid-data',
  })
  const epubSelector: AnnotationSelector = {
    version: 1,
    format: 'EPUB',
    chapter: 0,
    mode: 'text',
    cfi: null,
    text: captureTextSelector('A quiet reading space', 2, 7),
  }
  await storage.create(epub.handle, epubSelector)
  expect((await storage.list(epub.handle))[0]?.selector).toEqual(epubSelector)
})
it('migrates known v1 metadata exactly once and preserves annotation identity', async () => {
  const { database, storage } = setup()
  database.records.set(id, { ...legacy, file: new Blob(['not retained']) })
  const first = await storage.open(identity)
  expect(first.annotations).toMatchObject([
    { version: 2, id: 'legacy-highlight', note: '', createdAt: 1, updatedAt: 1 },
  ])
  expect((await storage.open(identity)).handle).toEqual(first.handle)
  expect(database.records.get(id)).toEqual({
    version: 2,
    id,
    ...identity,
    generation: first.handle.generation,
    annotations: first.annotations,
  })
})
it('preserves future, corrupt, duplicate and wrong-key data without overwriting or dropping entries', async () => {
  const { database, storage } = setup()
  for (const bad of [
    { ...legacy, version: 99 },
    { ...legacy, annotations: [{ ...legacy.annotations[0], version: 99 }] },
    { ...legacy, annotations: [legacy.annotations[0], legacy.annotations[0]] },
    { ...legacy, annotations: [{ ...legacy.annotations[0], selector: {} }] },
    {
      ...legacy,
      fingerprint: 'sha256-chunks-v1:' + 'b'.repeat(64),
      id: 'PDF:sha256-chunks-v1:' + 'b'.repeat(64),
    },
  ]) {
    database.records.set(id, bad)
    await expect(storage.open(identity)).rejects.toThrow()
    expect(database.records.get(id)).toEqual(bad)
  }
  expect(() => migrateAnnotationDocument({ ...legacy, version: 99 })).toThrow('Unsupported')
})
it('rolls back migration and CRUD when commit fails, and supports a clean retry', async () => {
  const { database, storage } = setup()
  database.records.set(id, legacy)
  database.nextFailure = new DOMException('quota', 'QuotaExceededError')
  await expect(storage.open(identity)).rejects.toMatchObject({ reason: 'quota' })
  expect(database.records.get(id)).toEqual(legacy)
  const { handle } = await storage.open(identity)
  database.nextFailure = new DOMException('quota', 'QuotaExceededError')
  await expect(storage.create(handle, selector)).rejects.toMatchObject({ reason: 'quota' })
  expect(await storage.list(handle)).toHaveLength(1)
  const created = await storage.create(handle, selector)
  database.nextFailure = new DOMException('quota', 'QuotaExceededError')
  await expect(storage.update(handle, created.id, { note: 'not saved' })).rejects.toMatchObject({
    reason: 'quota',
  })
  expect((await storage.list(handle)).find((a) => a.id === created.id)?.note).toBe('')
  database.nextFailure = Error('connection lost')
  await expect(storage.remove(handle, created.id)).rejects.toMatchObject({ reason: 'unavailable' })
  expect(await storage.list(handle)).toHaveLength(2)
})
it('does not resurrect cleared records or attach late edits to a recreated document', async () => {
  const { storage } = setup()
  const { handle } = await storage.open(identity)
  await storage.create(handle, selector)
  const clearing = storage.clearDocument(handle)
  const late = storage.create(handle, selector)
  await clearing
  await expect(late).rejects.toMatchObject({ reason: 'stale-document' })
  const fresh = await storage.open(identity)
  expect(fresh.annotations).toEqual([])
  expect(fresh.handle.generation).not.toBe(handle.generation)
  await expect(storage.clearDocument(handle)).rejects.toMatchObject({ reason: 'stale-document' })
  await expect(storage.create(handle, selector)).rejects.toMatchObject({ reason: 'stale-document' })
  await storage.create(fresh.handle, selector)
  expect(await storage.list(fresh.handle)).toHaveLength(1)
})
it('rejects oversized notes, invalid selectors/colors and collection overflow atomically', async () => {
  const { database, storage } = setup()
  const { handle } = await storage.open(identity)
  const created = await storage.create(handle, selector)
  await expect(
    storage.update(handle, created.id, { note: 'a'.repeat(4001) }),
  ).rejects.toMatchObject({ reason: 'invalid-data' })
  await expect(storage.create(handle, { ...selector, segments: [] })).rejects.toMatchObject({
    reason: 'invalid-data',
  })
  await expect(storage.create(handle, selector, 'red' as 'yellow')).rejects.toMatchObject({
    reason: 'invalid-data',
  })
  const record = database.records.get(id) as AnnotationDocument
  database.records.set(id, {
    ...record,
    annotations: Array.from({ length: 1000 }, (_, i) => ({ ...created, id: `annotation-${i}` })),
  })
  await expect(storage.create(handle, selector)).rejects.toMatchObject({ reason: 'limit' })
  expect(await storage.list(handle)).toHaveLength(1000)
  expect(() =>
    migrateAnnotationDocument({ ...legacy, annotations: Array(1001).fill(legacy.annotations[0]) }),
  ).toThrow()
})
it('reports blocked/unavailable storage without a success result', async () => {
  const { database, storage } = setup()
  const spy = vi.spyOn(database, 'transaction')
  spy.mockRejectedValueOnce(Error('Reading storage is blocked by another tab.'))
  await expect(storage.open(identity)).rejects.toMatchObject({ reason: 'blocked' })
  spy.mockRejectedValueOnce(new DOMException('disabled', 'SecurityError'))
  await expect(storage.open(identity)).rejects.toMatchObject({ reason: 'unavailable' })
  expect(database.records.size).toBe(0)
})

it('rejects invalid identities and aggregate geometry limits without committing', async () => {
  const { database, storage } = setup()
  await expect(storage.open({ ...identity, fingerprint: 'a.pdf' })).rejects.toMatchObject({
    reason: 'invalid-data',
  })
  expect(database.records.size).toBe(0)
  const { handle } = await storage.open(identity)
  const large: AnnotationSelector = {
    ...selector,
    segments: [
      {
        ...selector.segments[0]!,
        rectangles: Array(1000).fill(selector.segments[0]!.rectangles[0]),
      },
    ],
  }
  for (let i = 0; i < 10; i++) await storage.create(handle, large)
  await expect(storage.create(handle, large)).rejects.toMatchObject({ reason: 'limit' })
  expect(await storage.list(handle)).toHaveLength(10)
})

it('enforces combined metadata text limits and rolls back failed document deletion', async () => {
  const { database, storage } = setup()
  const { handle } = await storage.open(identity)
  const created = await storage.create(handle, selector)
  const record = database.records.get(id) as AnnotationDocument
  const many = Array.from({ length: 499 }, (_, i) => ({
    ...created,
    id: `note-${i}`,
    note: 'a'.repeat(4000),
  }))
  expect(() => migrateAnnotationDocument({ ...record, annotations: many })).toThrow(
    'metadata limit',
  )
  database.nextFailure = new DOMException('quota', 'QuotaExceededError')
  await expect(storage.clearDocument(handle)).rejects.toMatchObject({ reason: 'quota' })
  expect(await storage.list(handle)).toHaveLength(1)
})
