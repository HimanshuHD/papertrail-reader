import type { DiscoveredDocument } from '../features/library/discovery'
import type { WorkspaceTabs } from '../features/reader/session-snapshot'
import { fingerprintDocument } from './document-identity'

/** Paths choose candidates; only content identity authorizes a saved session. */
export async function revalidateTabs(
  saved: WorkspaceTabs,
  documents: readonly DiscoveredDocument[],
  signal?: AbortSignal,
  allowRenames = false,
): Promise<Map<string, DiscoveredDocument>> {
  const matches = new Map<string, DiscoveredDocument>()
  const checks = new Map<File, Promise<string | null>>()
  function fingerprint(file: File) {
    let check = checks.get(file)
    if (!check) {
      check = fingerprintDocument(file, signal).catch((error: unknown) => {
        if (signal?.aborted) throw error
        return null // One unreadable file must not block the other tabs.
      })
      checks.set(file, check)
    }
    return check
  }
  for (const entry of saved.sessions) {
    signal?.throwIfAborted()
    if (!entry.fingerprint) continue
    const compatible = documents.filter((item) => item.format === entry.document.format)
    const exact = compatible.filter((item) => item.relativePath === entry.document.relativePath)
    const candidates = allowRenames
      ? [...exact, ...compatible.filter((item) => !exact.includes(item))]
      : exact
    for (const document of candidates) {
      if ((await fingerprint(document.file)) === entry.fingerprint) {
        signal?.throwIfAborted()
        matches.set(entry.id, document)
        break
      }
    }
  }
  return matches
}
