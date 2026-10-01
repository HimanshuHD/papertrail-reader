import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canUseDirectoryPicker,
  describeLibrarySelection,
  requestDirectory,
  selectionFromFiles,
} from '../../src/features/library/browser-selection'

type PickerWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}

const originalSecureContext = window.isSecureContext
const originalPicker = (window as PickerWindow).showDirectoryPicker

afterEach(() => {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: originalSecureContext,
  })

  if (originalPicker) {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: originalPicker,
    })
  } else {
    delete (window as PickerWindow).showDirectoryPicker
  }

  vi.restoreAllMocks()
})

function configureWindow(secure: boolean, picker?: PickerWindow['showDirectoryPicker']) {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: secure,
  })

  if (picker) {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: picker,
    })
  } else {
    delete (window as PickerWindow).showDirectoryPicker
  }
}

describe('browser library selection', () => {
  it('only uses the native directory picker in a secure supporting context', () => {
    configureWindow(false, vi.fn())
    expect(canUseDirectoryPicker()).toBe(false)

    configureWindow(true)
    expect(canUseDirectoryPicker()).toBe(false)

    configureWindow(true, vi.fn())
    expect(canUseDirectoryPicker()).toBe(true)
  })

  it('returns a selected directory handle without enumerating it', async () => {
    const handle = { kind: 'directory', name: 'Reading' } as FileSystemDirectoryHandle
    const picker = vi.fn().mockResolvedValue(handle)
    configureWindow(true, picker)

    const result = await requestDirectory()

    expect(picker).toHaveBeenCalledWith({ mode: 'read' })
    expect(result).toEqual({
      ok: true,
      selection: { kind: 'directory', source: 'directory-picker', handle },
    })
  })

  it.each([
    ['AbortError', 'dismissed-or-denied'],
    ['SecurityError', 'blocked'],
  ] as const)('normalizes %s directory picker failures', async (name, reason) => {
    configureWindow(true, vi.fn().mockRejectedValue(new DOMException('picker failure', name)))

    await expect(requestDirectory()).resolves.toEqual({ ok: false, reason })
  })

  it('reports unsupported and unexpected picker failures', async () => {
    configureWindow(false)
    await expect(requestDirectory()).resolves.toEqual({ ok: false, reason: 'unavailable' })

    configureWindow(true, vi.fn().mockRejectedValue(new Error('unexpected')))
    await expect(requestDirectory()).resolves.toEqual({ ok: false, reason: 'failed' })
  })

  it('keeps input selections as raw browser files for later discovery', () => {
    const pdf = new File(['pdf'], 'guide.pdf', { type: 'application/pdf' })
    const epub = new File(['epub'], 'book.epub', { type: 'application/epub+zip' })

    const selection = selectionFromFiles([pdf, epub], 'file-input')

    expect(selection).toEqual({
      kind: 'files',
      source: 'file-input',
      files: [pdf, epub],
    })
    expect(describeLibrarySelection(selection!)).toContain('2 items selected from the file picker')
    expect(selectionFromFiles([], 'directory-input')).toBeNull()
  })
})
