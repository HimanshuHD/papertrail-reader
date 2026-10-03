import type { DiscoveredDocument } from '../features/library/discovery'
import type { WorkspaceSnapshot } from './workspace-storage'
import { verifyRememberedDocument } from './library-access'

/** Cached paths are context, never authority to open a freshly enumerated file. */
export async function revalidateWorkspace(
  saved: WorkspaceSnapshot,
  documents: readonly DiscoveredDocument[],
  signal?: AbortSignal,
): Promise<{ selectedId: string | null; activeDocument: DiscoveredDocument | null }> {
  const selected = documents.filter((document) => document.relativePath === saved.selectedPath)
  const active = documents.filter(
    (document) => document.relativePath === saved.activePath && document.format === 'PDF',
  )
  const remembered = saved.documents.filter(
    (document) => document.relativePath === saved.activePath,
  )
  const verified =
    active.length === 1 &&
    remembered.length === 1 &&
    (await verifyRememberedDocument(
      active[0]!.file,
      remembered[0],
      saved.activeFingerprint,
      signal,
    ))
  return {
    selectedId: selected.length === 1 ? selected[0]!.id : null,
    activeDocument: verified ? active[0]! : null,
  }
}
