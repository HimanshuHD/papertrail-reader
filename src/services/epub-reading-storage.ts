import { ReadingMetadataDatabase } from './reading-database'
import { fingerprintDocument } from './document-identity'
import { EPUB_ARCHIVE_LIMITS } from '../features/epub/archive-preflight'
import { normalizeLocation, type EpubLocation } from '../features/epub/location'
import { normalizeTypography, type EpubTypography } from '../features/epub/typography'
import { bookmarkName } from './pdf-bookmarks'

export interface EpubReadingSettings {
  textOnly: boolean
  typography: EpubTypography
  location?: EpubLocation
}
export interface EpubBookmark {
  id: string
  name: string
  location: EpubLocation
  createdAt: number
}
export interface EpubReadingRecord extends EpubReadingSettings {
  version: 1
  format: 'EPUB'
  id: string
  fingerprint: string
  name: string
  updatedAt: number
  bookmarks: EpubBookmark[]
}
export interface EpubReadingStorage {
  resolve(
    fingerprint: string,
    name: string,
  ): Promise<{ record: EpubReadingRecord; ambiguous: boolean }>
  save(id: string, settings: EpubReadingSettings): Promise<void>
  load(id: string): Promise<EpubBookmark[]>
  add(id: string, name: string, location: EpubLocation): Promise<EpubBookmark[]>
  rename(id: string, bookmark: string, name: string): Promise<EpubBookmark[]>
  remove(id: string, bookmark: string): Promise<EpubBookmark[]>
}
export async function fingerprintEpub(file: File, signal?: AbortSignal) {
  if (file.size > EPUB_ARCHIVE_LIMITS.archiveBytes)
    throw new RangeError('EPUB exceeds the size limit.')
  return fingerprintDocument(file, signal)
}
export function normalizeEpubSettings(value: unknown): EpubReadingSettings {
  const v = value && typeof value === 'object' ? (value as Partial<EpubReadingSettings>) : {}
  const location = normalizeLocation(v.location, EPUB_ARCHIVE_LIMITS.entries)
  return {
    textOnly: v.textOnly === true,
    typography: normalizeTypography(
      v.typography && typeof v.typography === 'object' ? v.typography : {},
    ),
    ...(location ? { location } : {}),
  }
}
export function normalizeEpubBookmarks(value: unknown): EpubBookmark[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  return value.slice(0, 500).flatMap((v: Partial<EpubBookmark> | null) => {
    const location = normalizeLocation(v?.location, EPUB_ARCHIVE_LIMITS.entries)
    if (
      !v ||
      typeof v.id !== 'string' ||
      !v.id ||
      v.id.length > 120 ||
      ids.has(v.id) ||
      typeof v.name !== 'string' ||
      !v.name.trim() ||
      v.name.trim().length > 120 ||
      !Number.isFinite(v.createdAt) ||
      v.createdAt! <= 0 ||
      !location
    )
      return []
    ids.add(v.id)
    return [{ id: v.id, name: v.name.trim(), location, createdAt: v.createdAt! }]
  })
}
export function normalizeEpubRecord(value: unknown): EpubReadingRecord | undefined {
  if (!value || typeof value !== 'object') return
  const v = value as Partial<EpubReadingRecord>
  if (
    v.version !== 1 ||
    v.format !== 'EPUB' ||
    typeof v.id !== 'string' ||
    !v.id.startsWith('epub:') ||
    v.id.length > 120 ||
    typeof v.fingerprint !== 'string' ||
    !/^sha256-chunks-v1:[a-f0-9]{64}$/u.test(v.fingerprint) ||
    typeof v.name !== 'string' ||
    v.name.length > 4096 ||
    !Number.isFinite(v.updatedAt)
  )
    return
  return {
    version: 1,
    format: 'EPUB',
    id: v.id,
    fingerprint: v.fingerprint,
    name: v.name,
    updatedAt: v.updatedAt!,
    ...normalizeEpubSettings(v),
    bookmarks: normalizeEpubBookmarks(v.bookmarks),
  }
}

/** EPUB-only, versioned metadata. Read/modify/write keeps bookmark and position saves atomic. */
export class IndexedDbEpubReadingStorage implements EpubReadingStorage {
  constructor(private readonly database = new ReadingMetadataDatabase('papertrail-epub-reading')) {}
  resolve(fingerprint: string, name: string) {
    return this.database.transaction<{ record: EpubReadingRecord; ambiguous: boolean }>(
      (store, done) => {
        const request = store.index('fingerprint').getAll(fingerprint)
        request.onsuccess = () => {
          const matches = request.result as unknown[]
          const valid = matches.length === 1 ? normalizeEpubRecord(matches[0]) : undefined
          if (valid) {
            const record = { ...valid, name: name.slice(0, 4096) }
            store.put(record)
            done({ record, ambiguous: false })
            return
          }
          const record: EpubReadingRecord = {
            version: 1,
            format: 'EPUB',
            id: `epub:${crypto.randomUUID()}`,
            fingerprint,
            name: name.slice(0, 4096),
            updatedAt: Date.now(),
            bookmarks: [],
            ...normalizeEpubSettings(null),
          }
          if (!matches.length) {
            if (!normalizeEpubRecord(record)) {
              store.transaction.abort()
              return
            }
            store.add(record)
          }
          done({ record, ambiguous: matches.length > 0 })
        }
      },
    )
  }
  private update<T>(
    id: string,
    edit: (record: EpubReadingRecord) => { record: EpubReadingRecord; result: T },
    write = true,
  ): Promise<T> {
    return this.database.transaction<T>((store, done) => {
      const request = store.get(id)
      request.onsuccess = () => {
        const record = normalizeEpubRecord(request.result)
        // Clearing storage must not resurrect a deleted reading record.
        if (!record) {
          store.transaction.abort()
          return
        }
        try {
          const next = edit(record)
          if (write) store.put(next.record)
          done(next.result)
        } catch {
          store.transaction.abort()
        }
      }
    })
  }
  save(id: string, settings: EpubReadingSettings) {
    const safe = normalizeEpubSettings(settings)
    return this.update<void>(id, (record) => ({
      record: {
        ...record,
        ...safe,
        location: safe.location ?? record.location,
        updatedAt: Date.now(),
      },
      result: undefined,
    }))
  }
  load(id: string) {
    return this.update(id, (record) => ({ record, result: record.bookmarks }), false)
  }
  add(id: string, name: string, value: EpubLocation) {
    const label = bookmarkName(name)
    const location = normalizeLocation(value, EPUB_ARCHIVE_LIMITS.entries)
    if (!location) return Promise.reject(new RangeError('Invalid EPUB bookmark location.'))
    return this.update(id, (record) => {
      if (record.bookmarks.length >= 500) throw new RangeError('Bookmark limit reached.')
      const bookmarks = [
        ...record.bookmarks,
        { id: crypto.randomUUID(), name: label, location, createdAt: Date.now() },
      ]
      return { record: { ...record, bookmarks }, result: bookmarks }
    })
  }
  rename(id: string, bookmark: string, name: string) {
    const label = bookmarkName(name)
    return this.update(id, (record) => {
      if (!record.bookmarks.some((v) => v.id === bookmark))
        throw new Error('Bookmark no longer exists.')
      const bookmarks = record.bookmarks.map((v) => (v.id === bookmark ? { ...v, name: label } : v))
      return { record: { ...record, bookmarks }, result: bookmarks }
    })
  }
  remove(id: string, bookmark: string) {
    return this.update(id, (record) => {
      const bookmarks = record.bookmarks.filter((v) => v.id !== bookmark)
      return { record: { ...record, bookmarks }, result: bookmarks }
    })
  }
}
