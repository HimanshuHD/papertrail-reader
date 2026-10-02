import type { DiscoveredDocument } from './discovery'
import { readPdfTitle } from '../pdf/pdf-session'

/** Sequential background work: publish the file list first, yield and cancel when the source changes. */
export async function enrichPdfTitles(
  documents: readonly DiscoveredDocument[],
  signal: AbortSignal,
  update: (id: string, title: string) => void,
  readTitle = readPdfTitle,
): Promise<void> {
  for (const document of documents) {
    if (signal.aborted) return
    if (document.format !== 'PDF') continue
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    if (signal.aborted) return
    const title = await readTitle(document.file, signal)
    if (signal.aborted) return
    if (title) update(document.id, title)
  }
}
