import type { BrowserLibrarySelection } from './browser-selection'

export type DocumentFormat = 'PDF' | 'EPUB'

export interface LibraryDocumentMetadata {
  /** Session-local identity only. Persistent identity belongs to #13. */
  id: string
  name: string
  /** Optional locally read PDF metadata; never replaces file identity. */
  title?: string
  format: DocumentFormat
  relativePath: string
  parentPath: string
  source: BrowserLibrarySelection['source']
}

export interface DiscoveredDocument extends LibraryDocumentMetadata {
  file: File
}

export interface DiscoveryProblem {
  path: string
  code: 'read-failed' | 'enumeration-failed'
  message: string
}

export interface DiscoveryProgress {
  scanned: number
  supported: number
  currentPath: string
}

export interface DiscoveryResult {
  status: 'completed' | 'cancelled'
  documents: readonly DiscoveredDocument[]
  problems: readonly DiscoveryProblem[]
  scanned: number
}

export interface DiscoveryOptions {
  signal?: AbortSignal
  onProgress?: (progress: DiscoveryProgress) => void
  /** Yield back to the event loop after this many traversal work units. */
  yieldEvery?: number
}

type TraversableDirectoryHandle = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>
}

const DEFAULT_YIELD_EVERY = 50

function normalizePath(path: string): string {
  return path
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/')
}

function parentPathOf(relativePath: string): string {
  const separator = relativePath.lastIndexOf('/')
  return separator < 0 ? '' : relativePath.slice(0, separator)
}

function formatFromName(name: string): DocumentFormat | null {
  const lower = name.toLocaleLowerCase()
  if (lower.endsWith('.pdf')) return 'PDF'
  if (lower.endsWith('.epub')) return 'EPUB'
  return null
}

function errorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }

  return 'Unknown browser file access error'
}

function makeDocument(
  file: File,
  relativePath: string,
  source: BrowserLibrarySelection['source'],
  sequence: number,
): DiscoveredDocument | null {
  const format = formatFromName(file.name)
  if (!format) return null

  const normalizedPath = normalizePath(relativePath || file.name)
  return {
    id: `${source}:${normalizedPath}:${file.size}:${file.lastModified}:${sequence}`,
    name: file.name,
    format,
    relativePath: normalizedPath,
    parentPath: parentPathOf(normalizedPath),
    source,
    file,
  }
}

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
}

export async function discoverDocuments(
  selection: BrowserLibrarySelection,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const documents: DiscoveredDocument[] = []
  const problems: DiscoveryProblem[] = []
  const yieldEvery = Math.max(1, options.yieldEvery ?? DEFAULT_YIELD_EVERY)
  let scanned = 0
  let workUnits = 0
  let sequence = 0

  const cancelled = () => options.signal?.aborted === true

  const report = (currentPath: string) => {
    options.onProgress?.({
      scanned,
      supported: documents.length,
      currentPath,
    })
  }

  const checkpoint = async () => {
    workUnits += 1
    if (workUnits % yieldEvery === 0) await yieldToBrowser()
  }

  const inspectFile = async (
    file: File,
    relativePath: string,
    source: BrowserLibrarySelection['source'],
  ) => {
    scanned += 1
    sequence += 1
    const normalizedPath = normalizePath(relativePath || file.name)
    const document = makeDocument(file, normalizedPath, source, sequence)
    if (document) documents.push(document)
    report(normalizedPath)
    await checkpoint()
  }

  if (selection.kind === 'files') {
    for (const file of selection.files) {
      if (cancelled()) break
      const relativePath =
        selection.source === 'directory-input' && file.webkitRelativePath
          ? file.webkitRelativePath
          : file.name
      await inspectFile(file, relativePath, selection.source)
    }

    return {
      status: cancelled() ? 'cancelled' : 'completed',
      documents,
      problems,
      scanned,
    }
  }

  const walkDirectory = async (
    directory: FileSystemDirectoryHandle,
    parentPath: string,
  ): Promise<void> => {
    if (cancelled()) return

    try {
      for await (const [entryName, entry] of (directory as TraversableDirectoryHandle).entries()) {
        if (cancelled()) return

        const relativePath = normalizePath(parentPath ? `${parentPath}/${entryName}` : entryName)

        if (entry.kind === 'directory') {
          await checkpoint()
          await walkDirectory(entry as FileSystemDirectoryHandle, relativePath)
          continue
        }

        scanned += 1
        sequence += 1

        try {
          const file = await (entry as FileSystemFileHandle).getFile()
          const document = makeDocument(file, relativePath, selection.source, sequence)
          if (document) documents.push(document)
        } catch (error) {
          problems.push({
            path: relativePath,
            code: 'read-failed',
            message: errorMessage(error),
          })
        }

        report(relativePath)
        await checkpoint()
      }
    } catch (error) {
      if (!cancelled()) {
        problems.push({
          path: parentPath || directory.name,
          code: 'enumeration-failed',
          message: errorMessage(error),
        })
      }
    }
  }

  await walkDirectory(selection.handle, '')

  return {
    status: cancelled() ? 'cancelled' : 'completed',
    documents,
    problems,
    scanned,
  }
}
