import { ReadingMetadataDatabase } from './reading-database'
import { fingerprintDocument } from './document-identity'
import { fingerprintEpub } from './epub-reading-storage'
import type { DiscoveredDocument, LibraryDocumentMetadata } from '../features/library/discovery'

export interface RecentDocument {
  format?: 'PDF' | 'EPUB'
  id: string
  fingerprint: string
  name: string
  title?: string
  relativePath: string
  openedAt: number
}
export interface RecentStorage {
  load(): Promise<RecentDocument[]>
  remember(entry: RecentDocument): Promise<RecentDocument[]>
  remove(id?: string): Promise<RecentDocument[]>
}
export const recentFormat = (entry: RecentDocument) => entry.format ?? 'PDF'
export function normalizeRecents(value: unknown): RecentDocument[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value
    .filter((entry): entry is RecentDocument => {
      if (!entry || typeof entry !== 'object') return false
      const valid =
        ['id', 'fingerprint', 'name', 'relativePath'].every(
          (key) =>
            typeof entry[key] === 'string' && entry[key].length > 0 && entry[key].length <= 4096,
        ) &&
        (entry.format === undefined || entry.format === 'PDF' || entry.format === 'EPUB') &&
        Number.isFinite(entry.openedAt) &&
        entry.openedAt > 0 &&
        (entry.title === undefined ||
          (typeof entry.title === 'string' && entry.title.length <= 4096))
      return valid
    })
    .sort((a, b) => b.openedAt - a.openedAt)
    .filter((entry) => {
      const identity = `${recentFormat(entry)}:${entry.fingerprint}`
      if (seen.has(identity)) return false
      seen.add(identity)
      return true
    })
    .slice(0, 20)
}
export class IndexedDbRecentStorage implements RecentStorage {
  private database = new ReadingMetadataDatabase('papertrail-recent')
  private change(edit: (entries: RecentDocument[]) => RecentDocument[]) {
    return this.database.transaction<RecentDocument[]>((store, done) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const entries = normalizeRecents(edit(normalizeRecents(request.result)))
        store.clear()
        entries.forEach((entry) => store.put(entry))
        done(entries)
      }
    })
  }
  load() {
    return this.change((entries) => entries)
  }
  remember(entry: RecentDocument) {
    return this.change((entries) => [
      entry,
      ...entries.filter(
        (item) =>
          item.fingerprint !== entry.fingerprint || recentFormat(item) !== recentFormat(entry),
      ),
    ])
  }
  remove(id?: string) {
    return this.change((entries) => (id ? entries.filter((entry) => entry.id !== id) : []))
  }
}
export function filterLibrary<T extends LibraryDocumentMetadata>(
  documents: readonly T[],
  query: string,
): readonly T[] {
  const terms = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return documents.filter((item) => {
    const text = `${item.name} ${item.title ?? ''} ${item.relativePath} ${item.format}`
      .normalize('NFKC')
      .toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
}
/** Verify content, never use names/paths as persistent identity or request new permissions. */
export async function matchRecent(
  entry: RecentDocument,
  documents: readonly DiscoveredDocument[],
  signal: AbortSignal,
): Promise<DiscoveredDocument | null> {
  const candidates = documents
    .filter((item) => item.format === recentFormat(entry))
    .sort(
      (a, b) =>
        Number(b.relativePath === entry.relativePath) -
        Number(a.relativePath === entry.relativePath),
    )
  for (const item of candidates) {
    signal.throwIfAborted()
    try {
      if (
        (await (item.format === 'EPUB' ? fingerprintEpub : fingerprintDocument)(
          item.file,
          signal,
        )) === entry.fingerprint
      )
        return item
    } catch {
      signal.throwIfAborted()
    }
  }
  return null
}
