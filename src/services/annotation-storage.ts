import { ReadingMetadataDatabase } from './reading-database'
import {
  ANNOTATION_LIMITS,
  annotationIdentity,
  normalizeAnnotationSelector,
  type AnnotationIdentity,
  type AnnotationSelector,
} from '../features/annotations/selectors'

export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink'
export interface Annotation {
  version: 2
  id: string
  selector: AnnotationSelector
  color: AnnotationColor
  /** Plain text only; UI adapters must never interpret this as HTML. */
  note: string
  createdAt: number
  updatedAt: number
}
export interface AnnotationHandle {
  identity: AnnotationIdentity
  /** Prevent late writes from attaching to a cleared/recreated document. */
  generation: string
}
export interface AnnotationDocument {
  version: 2
  id: string
  format: AnnotationIdentity['format']
  fingerprint: string
  generation: string
  annotations: Annotation[]
}
export type AnnotationStorageFailure =
  | 'unavailable'
  | 'quota'
  | 'blocked'
  | 'invalid-data'
  | 'unsupported-version'
  | 'stale-document'
  | 'missing-annotation'
  | 'limit'
export class AnnotationStorageError extends Error {
  constructor(
    public readonly reason: AnnotationStorageFailure,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause })
    this.name = 'AnnotationStorageError'
  }
}
function fail(reason: AnnotationStorageFailure, message: string): never {
  throw new AnnotationStorageError(reason, message)
}
function token(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{1,120}$/u.test(value)
}
function color(value: unknown): value is AnnotationColor {
  return typeof value === 'string' && ['yellow', 'green', 'blue', 'pink'].includes(value)
}
function note(value: unknown): value is string {
  return typeof value === 'string' && value.length <= ANNOTATION_LIMITS.note
}
function key(identity: AnnotationIdentity) {
  return `${identity.format}:${identity.fingerprint}`
}
function requireIdentity(value: unknown): AnnotationIdentity {
  return annotationIdentity(value) ?? fail('invalid-data', 'Invalid annotation document identity.')
}
function normalizeAnnotation(value: unknown, format: AnnotationIdentity['format']): Annotation {
  if (!value || typeof value !== 'object') fail('invalid-data', 'Invalid annotation record.')
  const v = value as Partial<Omit<Annotation, 'version'>> & { version?: number }
  // v1 is a supported metadata schema, not a previously shipped UI feature.
  if (v.version !== 1 && v.version !== 2)
    fail('unsupported-version', 'Unsupported annotation version; saved data was preserved.')
  const selector = normalizeAnnotationSelector(v.selector)
  if (
    !token(v.id) ||
    !selector ||
    selector.format !== format ||
    !color(v.color) ||
    !Number.isSafeInteger(v.createdAt) ||
    v.createdAt! <= 0 ||
    (v.version === 2 &&
      (!note(v.note) || !Number.isSafeInteger(v.updatedAt) || v.updatedAt! < v.createdAt!))
  )
    fail('invalid-data', 'Invalid annotation record; saved data was preserved.')
  return {
    version: 2,
    id: v.id,
    selector,
    color: v.color,
    note: v.version === 2 ? v.note! : '',
    createdAt: v.createdAt!,
    updatedAt: v.version === 2 ? v.updatedAt! : v.createdAt!,
  }
}
/** Whitelist fields, migrate only known versions, and reject a corrupt collection as a whole. */
export function migrateAnnotationDocument(value: unknown): AnnotationDocument {
  if (!value || typeof value !== 'object') fail('invalid-data', 'Invalid annotation document.')
  const v = value as Partial<Omit<AnnotationDocument, 'version'>> & { version?: number }
  if (v.version !== 1 && v.version !== 2)
    fail('unsupported-version', 'Unsupported annotation storage version; saved data was preserved.')
  const identity = requireIdentity(v)
  if (
    v.id !== key(identity) ||
    !Array.isArray(v.annotations) ||
    v.annotations.length > ANNOTATION_LIMITS.annotations ||
    (v.version === 2 && !token(v.generation))
  )
    fail('invalid-data', 'Invalid annotation document; saved data was preserved.')
  const annotations = v.annotations.map((a) => normalizeAnnotation(a, identity.format))
  checkDocumentLimits(annotations)
  if (new Set(annotations.map((a) => a.id)).size !== annotations.length)
    fail('invalid-data', 'Duplicate annotation IDs; saved data was preserved.')
  return {
    version: 2,
    id: key(identity),
    ...identity,
    generation: v.version === 2 ? v.generation! : crypto.randomUUID(),
    annotations,
  }
}
function checkDocumentLimits(annotations: Annotation[]) {
  let characters = 0
  let rectangles = 0
  for (const annotation of annotations) {
    characters += annotation.note.length
    const selector = annotation.selector
    const texts = selector.format === 'PDF' ? selector.segments.map((s) => s.text) : [selector.text]
    for (const text of texts)
      characters += text.exact.length + text.prefix.length + text.suffix.length
    if (selector.format === 'PDF')
      for (const segment of selector.segments) rectangles += segment.rectangles.length
    else characters += selector.cfi?.length ?? 0
  }
  if (
    characters > ANNOTATION_LIMITS.documentCharacters ||
    rectangles > ANNOTATION_LIMITS.documentRectangles
  )
    fail('limit', 'Annotation metadata limit reached for this document; saved data was preserved.')
}
function storageFailure(error: unknown): AnnotationStorageError {
  if (error instanceof AnnotationStorageError) return error
  // DOMException/another frame's errors need not inherit this realm's Error constructor.
  const details =
    error && typeof error === 'object' ? (error as { name?: unknown; message?: unknown }) : {}
  if (details.name === 'QuotaExceededError')
    return new AnnotationStorageError(
      'quota',
      'Annotation storage is full; the change was not saved.',
      error,
    )
  const blocked = typeof details.message === 'string' && details.message.includes('blocked')
  return new AnnotationStorageError(
    blocked ? 'blocked' : 'unavailable',
    'Annotation storage is unavailable; the change was not saved.',
    error,
  )
}
export interface AnnotationStorage {
  open(
    identity: AnnotationIdentity,
  ): Promise<{ handle: AnnotationHandle; annotations: Annotation[] }>
  list(handle: AnnotationHandle): Promise<Annotation[]>
  create(
    handle: AnnotationHandle,
    selector: AnnotationSelector,
    color?: AnnotationColor,
    note?: string,
  ): Promise<Annotation>
  update(
    handle: AnnotationHandle,
    id: string,
    patch: { note?: string; color?: AnnotationColor },
  ): Promise<Annotation>
  remove(handle: AnnotationHandle, id: string): Promise<void>
  clearDocument(handle: AnnotationHandle): Promise<void>
}

/** Separate local metadata database: no PDF/EPUB bytes, handles, paths or remote calls. */
export class IndexedDbAnnotationStorage implements AnnotationStorage {
  constructor(private readonly database = new ReadingMetadataDatabase('papertrail-annotations')) {}

  private async access<T>(
    identity: AnnotationIdentity,
    edit: (record: AnnotationDocument | undefined, store: IDBObjectStore) => T,
  ): Promise<T> {
    const safe = requireIdentity(identity)
    let failure: unknown
    try {
      return await this.database.transaction<T>((store, done) => {
        const request = store.get(key(safe))
        request.onsuccess = () => {
          try {
            const record =
              request.result === undefined ? undefined : migrateAnnotationDocument(request.result)
            if (record && record.id !== key(safe))
              fail('invalid-data', 'Annotation identity does not match its storage key.')
            done(edit(record, store))
          } catch (error) {
            failure = error
            store.transaction.abort()
          }
        }
      })
    } catch (error) {
      throw storageFailure(failure ?? error)
    }
  }

  async open(identity: AnnotationIdentity) {
    const safe = requireIdentity(identity)
    return this.access(safe, (existing, store) => {
      const record: AnnotationDocument = existing ?? {
        version: 2,
        id: key(safe),
        ...safe,
        generation: crypto.randomUUID(),
        annotations: [],
      }
      store.put(record)
      return {
        handle: { identity: safe, generation: record.generation },
        annotations: record.annotations,
      }
    })
  }
  private withHandle<T>(
    handle: AnnotationHandle,
    edit: (record: AnnotationDocument, store: IDBObjectStore) => T,
  ) {
    return this.access(handle.identity, (record, store) => {
      if (!record || record.generation !== handle.generation)
        fail(
          'stale-document',
          'Annotation document was cleared or replaced; reselect it before editing.',
        )
      return edit(record, store)
    })
  }
  list(handle: AnnotationHandle) {
    return this.withHandle(handle, (record) => record.annotations)
  }
  create(
    handle: AnnotationHandle,
    value: AnnotationSelector,
    shade: AnnotationColor = 'yellow',
    noteText = '',
  ) {
    return this.withHandle(handle, (record, store) => {
      const selector = normalizeAnnotationSelector(value)
      if (!selector || selector.format !== record.format || !color(shade) || !note(noteText))
        fail('invalid-data', 'Invalid annotation selection or color.')
      if (record.annotations.length >= ANNOTATION_LIMITS.annotations)
        fail('limit', 'Annotation limit reached for this document.')
      const now = Date.now()
      const annotation: Annotation = {
        version: 2,
        id: crypto.randomUUID(),
        selector,
        color: shade,
        note: noteText,
        createdAt: now,
        updatedAt: now,
      }
      const annotations = [...record.annotations, annotation]
      checkDocumentLimits(annotations)
      store.put({ ...record, annotations })
      return annotation
    })
  }
  update(handle: AnnotationHandle, id: string, patch: { note?: string; color?: AnnotationColor }) {
    // Copy only supported fields, so an external patch cannot replace the anchor or identity.
    const safe = {
      ...(patch.note === undefined ? {} : { note: patch.note }),
      ...(patch.color === undefined ? {} : { color: patch.color }),
    }
    return this.withHandle(handle, (record, store) => {
      if (
        (safe.note !== undefined && !note(safe.note)) ||
        (safe.color !== undefined && !color(safe.color))
      )
        fail('invalid-data', 'Invalid annotation note or color.')
      const previous = record.annotations.find((a) => a.id === id)
      if (!previous) fail('missing-annotation', 'Annotation no longer exists.')
      const annotation = {
        ...previous,
        ...safe,
        updatedAt: Math.max(previous.updatedAt, Date.now()),
      }
      const annotations = record.annotations.map((a) => (a.id === id ? annotation : a))
      checkDocumentLimits(annotations)
      store.put({
        ...record,
        annotations,
      })
      return annotation
    })
  }
  remove(handle: AnnotationHandle, id: string) {
    return this.withHandle(handle, (record, store) => {
      if (!record.annotations.some((a) => a.id === id))
        fail('missing-annotation', 'Annotation no longer exists.')
      store.put({ ...record, annotations: record.annotations.filter((a) => a.id !== id) })
    })
  }
  clearDocument(handle: AnnotationHandle) {
    return this.withHandle(handle, (record, store) => {
      store.delete(record.id)
    })
  }
}
