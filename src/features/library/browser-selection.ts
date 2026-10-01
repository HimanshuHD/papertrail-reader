export type BrowserLibrarySelection =
  | {
      kind: 'directory'
      source: 'directory-picker'
      handle: FileSystemDirectoryHandle
    }
  | {
      kind: 'files'
      source: 'directory-input' | 'file-input'
      files: readonly File[]
    }

export type DirectoryPickerFailure = 'dismissed-or-denied' | 'blocked' | 'unavailable' | 'failed'

export type LibraryRefreshAction = 'refresh-directory' | 'reselect-directory' | 'reselect-files'

export type DirectoryPickerResult =
  { ok: true; selection: BrowserLibrarySelection } | { ok: false; reason: DirectoryPickerFailure }

type DirectoryPicker = (options?: {
  mode?: 'read' | 'readwrite'
}) => Promise<FileSystemDirectoryHandle>

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: DirectoryPicker
}

export function canUseDirectoryPicker(target: DirectoryPickerWindow = window): boolean {
  return target.isSecureContext && typeof target.showDirectoryPicker === 'function'
}

export async function requestDirectory(
  target: DirectoryPickerWindow = window,
): Promise<DirectoryPickerResult> {
  if (!canUseDirectoryPicker(target)) return { ok: false, reason: 'unavailable' }

  try {
    const handle = await target.showDirectoryPicker!({ mode: 'read' })
    return {
      ok: true,
      selection: {
        kind: 'directory',
        source: 'directory-picker',
        handle,
      },
    }
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'AbortError') return { ok: false, reason: 'dismissed-or-denied' }
      if (error.name === 'SecurityError') return { ok: false, reason: 'blocked' }
    }
    return { ok: false, reason: 'failed' }
  }
}

export function selectionFromFiles(
  files: Iterable<File>,
  source: 'directory-input' | 'file-input',
): BrowserLibrarySelection | null {
  const selected = Array.from(files)
  if (selected.length === 0) return null
  return { kind: 'files', source, files: selected }
}

export function describeLibrarySelection(selection: BrowserLibrarySelection): string {
  if (selection.kind === 'directory') {
    return `Folder “${selection.handle.name}” selected.`
  }

  const noun = selection.files.length === 1 ? 'item' : 'items'
  const origin = selection.source === 'directory-input' ? 'folder' : 'file picker'
  return `${selection.files.length} ${noun} selected from the ${origin}.`
}

export function refreshActionForSelection(
  selection: BrowserLibrarySelection,
): LibraryRefreshAction {
  if (selection.kind === 'directory') return 'refresh-directory'
  return selection.source === 'directory-input' ? 'reselect-directory' : 'reselect-files'
}

export function librarySelectionLabel(selection: BrowserLibrarySelection): string {
  if (selection.kind === 'directory') return selection.handle.name
  if (selection.source === 'file-input') return 'Selected files'

  const roots = new Set(
    selection.files
      .map((file) => file.webkitRelativePath.split('/').filter(Boolean)[0])
      .filter((value): value is string => Boolean(value)),
  )

  return roots.size === 1 ? [...roots][0]! : 'Selected folder'
}
