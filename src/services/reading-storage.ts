import { normalizePdfView, type PdfViewSettings } from './pdf-reading-state'

export interface ReadingRecord {
  id: string
  version: 1 | 2
  view?: PdfViewSettings
  fingerprint: string
  name: string
  page: number
  updatedAt: number
}

export interface ReadingStorage {
  resolve(fingerprint: string, name: string): Promise<{ record: ReadingRecord; ambiguous: boolean }>
  save(id: string, page: number, view?: PdfViewSettings): Promise<void>
}

/** Connections are short-lived so upgrades/deletion by another tab cannot leave stale handles. */
export class IndexedDbReadingStorage implements ReadingStorage {
  constructor(private readonly databaseName = 'papertrail-reading') {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error('Reading storage unavailable.'))
      const request = indexedDB.open(this.databaseName, 1)
      let blocked = false
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('documents', { keyPath: 'id' })
        store.createIndex('fingerprint', 'fingerprint')
      }
      request.onblocked = () => {
        blocked = true
        reject(new Error('Reading storage is blocked by another tab.'))
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        if (blocked) request.result.close()
        else resolve(request.result)
      }
    })
  }

  private async transaction<T>(
    run: (store: IDBObjectStore, result: (value: T) => void) => void,
  ): Promise<T> {
    const database = await this.open()
    try {
      return await new Promise<T>((resolve, reject) => {
        const transaction = database.transaction('documents', 'readwrite')
        let result: T
        transaction.oncomplete = () => resolve(result)
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('Reading storage transaction aborted.'))
        transaction.onerror = () => reject(transaction.error)
        try {
          run(transaction.objectStore('documents'), (value) => {
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

  resolve(
    fingerprint: string,
    name: string,
  ): Promise<{ record: ReadingRecord; ambiguous: boolean }> {
    return this.transaction((store, done) => {
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

  save(id: string, page: number, view?: PdfViewSettings): Promise<void> {
    if (!Number.isInteger(page) || page < 1)
      return Promise.reject(new RangeError('Invalid reading page.'))
    return this.transaction<void>((store, done) => {
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
            updatedAt: Date.now(),
          })
        done(undefined)
      }
    })
  }
}
