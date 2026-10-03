import { ReadingMetadataDatabase } from './reading-database'
import { normalizePdfAnchor, type PdfReadingAnchor } from './pdf-reading-state'
import type { ReadingRecord } from './reading-storage'

export interface PdfBookmark {
  id: string
  name: string
  anchor: PdfReadingAnchor
  createdAt: number
}
export interface BookmarkStorage {
  load(documentId: string): Promise<PdfBookmark[]>
  add(documentId: string, name: string, anchor: PdfReadingAnchor): Promise<PdfBookmark[]>
  rename(documentId: string, bookmarkId: string, name: string): Promise<PdfBookmark[]>
  remove(documentId: string, bookmarkId: string): Promise<PdfBookmark[]>
}

export function bookmarkName(value: string): string {
  const name = value.trim()
  if (!name || name.length > 120) throw new RangeError('Use a bookmark name of 1–120 characters.')
  return name
}

/** Invalid metadata is ignored; valid bookmarks never borrow another document's identity. */
export function normalizeBookmarks(value: unknown): PdfBookmark[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  return value.flatMap((item: Partial<PdfBookmark> | null) => {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) return []
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 120)
      return []
    const anchor = normalizePdfAnchor(item.anchor)
    if (!anchor || !Number.isFinite(item.createdAt)) return []
    ids.add(item.id)
    return [{ id: item.id, name: item.name.trim(), anchor, createdAt: item.createdAt! }]
  })
}

/** Atomic read/modify/write shares the document store with reading position saves. */
export class IndexedDbBookmarkStorage implements BookmarkStorage {
  constructor(private readonly database = new ReadingMetadataDatabase()) {}

  private update(
    documentId: string,
    transform?: (bookmarks: PdfBookmark[]) => PdfBookmark[],
  ): Promise<PdfBookmark[]> {
    return this.database.transaction((store, done) => {
      const request = store.get(documentId)
      request.onsuccess = () => {
        const record = request.result as (ReadingRecord & { bookmarks?: unknown }) | undefined
        if (!record || (record.version !== 1 && record.version !== 2)) {
          // Clearing storage must not resurrect an old document or its bookmarks.
          store.transaction.abort()
          return
        }
        try {
          const bookmarks = normalizeBookmarks(record.bookmarks)
          const next = transform ? transform(bookmarks) : bookmarks
          if (transform) store.put({ ...record, bookmarks: next })
          done(next)
        } catch {
          store.transaction.abort()
        }
      }
    })
  }

  load(documentId: string) {
    return this.update(documentId)
  }
  add(documentId: string, name: string, value: PdfReadingAnchor) {
    const label = bookmarkName(name)
    const anchor = normalizePdfAnchor(value)
    if (!anchor) return Promise.reject(new RangeError('Invalid bookmark position.'))
    return this.update(documentId, (bookmarks) => {
      if (bookmarks.length >= 500) throw new RangeError('Bookmark limit reached.')
      return [...bookmarks, { id: crypto.randomUUID(), name: label, anchor, createdAt: Date.now() }]
    })
  }
  rename(documentId: string, bookmarkId: string, name: string) {
    const label = bookmarkName(name)
    return this.update(documentId, (bookmarks) => {
      if (!bookmarks.some((bookmark) => bookmark.id === bookmarkId))
        throw new Error('Bookmark no longer exists.')
      return bookmarks.map((bookmark) =>
        bookmark.id === bookmarkId ? { ...bookmark, name: label } : bookmark,
      )
    })
  }
  remove(documentId: string, bookmarkId: string) {
    return this.update(documentId, (bookmarks) =>
      bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
    )
  }
}
