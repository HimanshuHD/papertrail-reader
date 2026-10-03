/** Connections are short-lived so upgrades/deletion by another tab cannot leave stale handles. */
export class ReadingMetadataDatabase {
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

  async transaction<T>(
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
}
