import type { BrowserLibrarySelection } from '../features/library/browser-selection'
import type { CachedLibraryDocument } from './workspace-storage'
import { fingerprintDocument } from './document-identity'

type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission?: (options: { mode: 'read' }) => Promise<PermissionState>
  requestPermission?: (options: { mode: 'read' }) => Promise<PermissionState>
}
export type LibraryAccess =
  | { status: 'granted'; selection: BrowserLibrarySelection }
  | { status: 'prompt' | 'denied' | 'reselect' | 'missing' }

export async function restoreDirectoryAccess(
  handle: FileSystemDirectoryHandle | null,
  gesture = false,
): Promise<LibraryAccess> {
  if (!handle) return { status: 'reselect' }
  const directory = handle as PermissionHandle
  try {
    if (!directory.queryPermission || (gesture && !directory.requestPermission))
      return { status: 'reselect' }
    // Request only from the explicit Resume action; do not open a picker on startup.
    const permission = gesture
      ? await directory.requestPermission!({ mode: 'read' })
      : await directory.queryPermission({ mode: 'read' })
    if (permission !== 'granted') return { status: permission }
    return {
      status: 'granted',
      selection: { kind: 'directory', source: 'directory-picker', handle },
    }
  } catch {
    return { status: 'missing' }
  }
}

/** Verify the remembered path against fresh file metadata and content before auto-opening. */
export async function verifyRememberedDocument(
  file: File,
  saved: CachedLibraryDocument | undefined,
  fingerprint: string | null,
  signal?: AbortSignal,
): Promise<boolean> {
  if (
    !saved ||
    !fingerprint ||
    file.size !== saved.size ||
    file.lastModified !== saved.lastModified
  )
    return false
  return (await fingerprintDocument(file, signal)) === fingerprint
}
