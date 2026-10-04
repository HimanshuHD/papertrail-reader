import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { useWorkspaceContinuity } from '../../src/composables/useWorkspaceContinuity'
import {
  cacheLibraryDocuments,
  type WorkspaceSnapshot,
  type WorkspaceStorage,
} from '../../src/services/workspace-storage'
import { restoreDirectoryAccess, verifyRememberedDocument } from '../../src/services/library-access'

vi.mock('../../src/services/document-identity', () => ({
  fingerprintDocument: vi.fn(async (file: File) => file.name),
}))
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})
function snapshot(label = 'books'): WorkspaceSnapshot {
  return {
    version: 1,
    source: 'file-input',
    label,
    handle: null,
    documents: [],
    selectedPath: null,
    activePath: null,
    activeFingerprint: null,
    collapsedPaths: ['books/reference'],
    libraryScroll: 250,
    sidebarOpen: false,
    sidebarWidth: 380,
  }
}
function setup(storage: WorkspaceStorage) {
  let workspace!: ReturnType<typeof useWorkspaceContinuity>
  wrappers.push(
    mount({
      setup() {
        workspace = useWorkspaceContinuity(storage)
        return () => null
      },
    }),
  )
  return workspace
}
function repository(): WorkspaceStorage {
  return {
    load: vi.fn(async () => snapshot()),
    save: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  }
}

it('retains metadata when file-input sources need reselection and never asks permission at startup', async () => {
  const storage = repository()
  const workspace = setup(storage)
  const loaded = vi.fn()
  expect(await workspace.restore(loaded)).toEqual({ status: 'reselect' })
  expect(loaded).toHaveBeenCalledWith(snapshot())
  expect(workspace.snapshot.value?.collapsedPaths).toEqual(['books/reference'])
  const queryPermission = vi.fn(async () => 'prompt' as const)
  const requestPermission = vi.fn(async () => 'granted' as const)
  const handle = {
    kind: 'directory',
    queryPermission,
    requestPermission,
  } as unknown as FileSystemDirectoryHandle
  expect(await restoreDirectoryAccess(handle)).toEqual({ status: 'prompt' })
  expect(requestPermission).not.toHaveBeenCalled()
  expect((await restoreDirectoryAccess(handle, true)).status).toBe('granted')
  expect(requestPermission).toHaveBeenCalledExactlyOnceWith({ mode: 'read' })
})

it('handles denied, missing and unsupported directory access without opening pickers', async () => {
  for (const permission of ['granted', 'denied'] as const) {
    const handle = {
      queryPermission: vi.fn(async () => permission),
    } as unknown as FileSystemDirectoryHandle
    expect((await restoreDirectoryAccess(handle)).status).toBe(permission)
  }
  expect(await restoreDirectoryAccess({} as FileSystemDirectoryHandle)).toEqual({
    status: 'reselect',
  })
  expect(
    await restoreDirectoryAccess({
      queryPermission: async () => {
        throw new Error('gone')
      },
    } as unknown as FileSystemDirectoryHandle),
  ).toEqual({ status: 'missing' })
})

it('does not attach a late restored workspace after a new source is selected', async () => {
  const storage = repository()
  let complete!: (value: WorkspaceSnapshot) => void
  vi.mocked(storage.load).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve
      }),
  )
  const workspace = setup(storage)
  const restore = workspace.restore()
  workspace.remember(snapshot('new selection'))
  complete(snapshot('old selection'))
  expect(await restore).toBeNull()
  expect(workspace.snapshot.value?.label).toBe('new selection')
})

it('debounces UI writes, flushes on pagehide and clears queued references before Forget', async () => {
  vi.useFakeTimers()
  const storage = repository()
  const workspace = setup(storage)
  workspace.remember(snapshot())
  workspace.patch({ libraryScroll: 300 })
  workspace.patch({ libraryScroll: 400 })
  window.dispatchEvent(new Event('pagehide'))
  await flushPromises()
  expect(storage.save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ libraryScroll: 400 }),
  )
  workspace.patch({ sidebarWidth: 420 })
  await workspace.forget()
  await vi.advanceTimersByTimeAsync(300)
  expect(storage.save).toHaveBeenCalledTimes(1)
  expect(storage.clear).toHaveBeenCalledOnce()
  expect(workspace.snapshot.value).toBeNull()
})

it('serializes Forget before writes for a newly selected library', async () => {
  const storage = repository()
  let clear!: () => void
  vi.mocked(storage.clear).mockImplementation(
    () =>
      new Promise((resolve) => {
        clear = resolve
      }),
  )
  const workspace = setup(storage)
  workspace.remember(snapshot())
  const forgetting = workspace.forget()
  await flushPromises()
  workspace.remember(snapshot('new library'))
  window.dispatchEvent(new Event('pagehide'))
  clear()
  await forgetting
  await flushPromises()
  expect(storage.save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ label: 'new library' }),
  )
  expect(workspace.snapshot.value?.label).toBe('new library')
})

it('stores a byte-free listing and requires both file metadata and content identity to auto-open', async () => {
  const file = new File(['pdf'], 'book.pdf', { lastModified: 100 })
  const cached = cacheLibraryDocuments([
    {
      id: 'book',
      name: file.name,
      relativePath: 'books/book.pdf',
      parentPath: 'books',
      format: 'PDF',
      source: 'file-input',
      file,
    },
  ])[0]!
  expect(cached).not.toHaveProperty('file')
  expect(await verifyRememberedDocument(file, cached, 'book.pdf')).toBe(true)
  expect(await verifyRememberedDocument(file, cached, 'different content')).toBe(false)
  expect(await verifyRememberedDocument(file, undefined, 'book.pdf')).toBe(false)
  expect(
    await verifyRememberedDocument(
      new File(['pdf'], 'book.pdf', { lastModified: 200 }),
      cached,
      'book.pdf',
    ),
  ).toBe(false)
  expect(await verifyRememberedDocument(file, cached, null)).toBe(false)
})

it('keeps ordinary reading available when workspace storage fails and allows removal retry', async () => {
  const storage = repository()
  vi.mocked(storage.load).mockRejectedValue(new Error('blocked'))
  vi.mocked(storage.clear).mockRejectedValueOnce(new Error('blocked'))
  const workspace = setup(storage)
  expect(await workspace.restore()).toBeNull()
  expect(workspace.notice.value).toContain('unavailable')
  await workspace.forget()
  expect(workspace.notice.value).toContain('Try Forget')
  await workspace.forget()
  expect(workspace.notice.value).toBe('')
})

it('never guesses among duplicate paths or automatically opens a moved document', async () => {
  const { revalidateWorkspace } = await import('../../src/services/workspace-revalidation')
  const file = new File(['pdf'], 'book.pdf', { lastModified: 100 })
  const document = {
    id: 'book',
    name: file.name,
    relativePath: 'books/book.pdf',
    parentPath: 'books',
    format: 'PDF' as const,
    source: 'file-input' as const,
    file,
  }
  const saved = {
    ...snapshot(),
    documents: cacheLibraryDocuments([document]),
    selectedPath: document.relativePath,
    activePath: document.relativePath,
    activeFingerprint: file.name,
  }
  expect(await revalidateWorkspace(saved, [document])).toEqual({
    selectedId: 'book',
    activeDocument: document,
  })
  expect(await revalidateWorkspace(saved, [document, { ...document, id: 'duplicate' }])).toEqual({
    selectedId: null,
    activeDocument: null,
  })
  expect(
    await revalidateWorkspace(saved, [{ ...document, relativePath: 'moved/book.pdf' }]),
  ).toEqual({ selectedId: null, activeDocument: null })
})

it('revalidates an active EPUB with granted file access without borrowing a PDF identity', async () => {
  const { revalidateWorkspace } = await import('../../src/services/workspace-revalidation')
  const file = new File(['epub'], 'book.epub', { lastModified: 100 })
  const item = {
    id: 'epub',
    name: file.name,
    relativePath: file.name,
    parentPath: '',
    format: 'EPUB' as const,
    source: 'file-input' as const,
    file,
  }
  const saved = {
    ...snapshot(),
    documents: cacheLibraryDocuments([item]),
    selectedPath: file.name,
    activePath: file.name,
    activeFingerprint: file.name,
  }
  expect((await revalidateWorkspace(saved, [item])).activeDocument).toEqual(item)
  expect((await revalidateWorkspace(saved, [{ ...item, format: 'PDF' }])).activeDocument).toBeNull()
  expect(
    (await revalidateWorkspace({ ...saved, activeFingerprint: 'changed' }, [item])).activeDocument,
  ).toBeNull()
})
