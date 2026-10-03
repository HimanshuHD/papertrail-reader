import { ReadingMetadataDatabase } from './reading-database'
import type { PdfBookmark } from './pdf-bookmarks'
import {
  normalizePdfView,
  normalizePdfAnchor,
  type PdfReadingAnchor,
  type PdfViewSettings,
} from './pdf-reading-state'

export interface ReadingRecord {
  id: string
  version: 1 | 2
  bookmarks?: PdfBookmark[]
  anchor?: PdfReadingAnchor
  view?: PdfViewSettings
  fingerprint: string
  name: string
  page: number
  updatedAt: number
}

export interface ReadingStorage {
  resolve(fingerprint: string, name: string): Promise<{ record: ReadingRecord; ambiguous: boolean }>
  save(id: string, page: number, view?: PdfViewSettings, anchor?: PdfReadingAnchor): Promise<void>
}

export class IndexedDbReadingStorage implements ReadingStorage {
  private readonly database: ReadingMetadataDatabase
  constructor(databaseName = 'papertrail-reading') {
    this.database = new ReadingMetadataDatabase(databaseName)
  }

  resolve(
    fingerprint: string,
    name: string,
  ): Promise<{ record: ReadingRecord; ambiguous: boolean }> {
    return this.database.transaction((store, done) => {
      const request = store.index('fingerprint').getAll(fingerprint)
      request.onsuccess = () => {
        const matches = request.result as ReadingRecord[]
        const valid = matches.filter(
          (record) =>
            (record.version === 1 || record.version === 2) &&
            Number.isInteger(record.page) &&
            record.page >= 1,
        )
        if (matches.length === 1 && valid.length === 1) {
          const record: ReadingRecord = {
            ...valid[0]!,
            version: 2,
            view: normalizePdfView(valid[0]!.view),
            anchor: normalizePdfAnchor(valid[0]!.anchor),
          }
          store.put(record)
          done({ record, ambiguous: false })
          return
        }
        const record: ReadingRecord = {
          id: crypto.randomUUID(),
          version: 2,
          view: normalizePdfView(),
          fingerprint,
          name,
          page: 1,
          updatedAt: Date.now(),
        }
        // Never choose between ambiguous/corrupt matches or overwrite their positions.
        if (matches.length === 0) store.add(record)
        done({ record, ambiguous: matches.length > 0 })
      }
    })
  }

  save(id: string, page: number, view?: PdfViewSettings, anchor?: PdfReadingAnchor): Promise<void> {
    if (!Number.isInteger(page) || page < 1)
      return Promise.reject(new RangeError('Invalid reading page.'))
    return this.database.transaction<void>((store, done) => {
      const request = store.get(id)
      request.onsuccess = () => {
        const record = request.result as ReadingRecord | undefined
        // Cleared storage starts fresh on reselection; do not resurrect deleted metadata.
        if (record && (record.version === 1 || record.version === 2))
          store.put({
            ...record,
            version: 2,
            page,
            view: normalizePdfView(view ?? record.view),
            anchor: normalizePdfAnchor(anchor),
            updatedAt: Date.now(),
          })
        done(undefined)
      }
    })
  }
}
