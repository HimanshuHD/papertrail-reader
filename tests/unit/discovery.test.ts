import { describe, expect, it } from 'vitest'
import { discoverDocuments } from '../../src/features/library/discovery'
import type { BrowserLibrarySelection } from '../../src/features/library/browser-selection'

function inputFile(name: string, relativePath = name, type = '') {
  const file = new File([name], name, { type, lastModified: 123 })
  Object.defineProperty(file, 'webkitRelativePath', {
    configurable: true,
    value: relativePath,
  })
  return file
}

function fileHandle(
  name: string,
  fileOrError: File | Error | DOMException,
): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    getFile: async () => {
      if (fileOrError instanceof File) return fileOrError
      throw fileOrError
    },
  } as FileSystemFileHandle
}

function directoryHandle(
  name: string,
  entries: Array<[string, FileSystemHandle]>,
): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async *entries() {
      for (const entry of entries) yield entry
    },
  } as unknown as FileSystemDirectoryHandle
}

describe('browser document discovery', () => {
  it('discovers supported directory-input files case-insensitively and preserves relative paths', async () => {
    const pdf = inputFile('Guide.PDF', 'Reading/Docs/Guide.PDF')
    const epub = inputFile('novel.EpUb', 'Reading/Books/novel.EpUb')
    const text = inputFile('notes.txt', 'Reading/notes.txt')

    const result = await discoverDocuments({
      kind: 'files',
      source: 'directory-input',
      files: [pdf, epub, text],
    })

    expect(result.status).toBe('completed')
    expect(result.scanned).toBe(3)
    expect(result.problems).toEqual([])
    expect(
      result.documents.map((document) => ({
        name: document.name,
        format: document.format,
        relativePath: document.relativePath,
        parentPath: document.parentPath,
      })),
    ).toEqual([
      {
        name: 'Guide.PDF',
        format: 'PDF',
        relativePath: 'Reading/Docs/Guide.PDF',
        parentPath: 'Reading/Docs',
      },
      {
        name: 'novel.EpUb',
        format: 'EPUB',
        relativePath: 'Reading/Books/novel.EpUb',
        parentPath: 'Reading/Books',
      },
    ])
  })

  it('keeps individual file selections flat and assigns unique session ids', async () => {
    const first = inputFile('same.pdf', 'ignored/first/same.pdf')
    const second = inputFile('same.pdf', 'ignored/second/same.pdf')

    const result = await discoverDocuments({
      kind: 'files',
      source: 'file-input',
      files: [first, second],
    })

    expect(result.documents.map((document) => document.relativePath)).toEqual([
      'same.pdf',
      'same.pdf',
    ])
    expect(new Set(result.documents.map((document) => document.id)).size).toBe(2)
  })

  it('preserves Unicode paths from folder-input snapshots', async () => {
    const file = inputFile('कहानी.epub', 'पुस्तकें/यात्रा/कहानी.epub')

    const result = await discoverDocuments({
      kind: 'files',
      source: 'directory-input',
      files: [file],
    })

    expect(result.documents[0]?.relativePath).toBe('पुस्तकें/यात्रा/कहानी.epub')
    expect(result.documents[0]?.parentPath).toBe('पुस्तकें/यात्रा')
  })

  it('walks an approved directory handle recursively without inventing absolute paths', async () => {
    const rootPdf = new File(['root'], 'root.pdf', { lastModified: 1 })
    const nestedEpub = new File(['nested'], 'book.epub', { lastModified: 2 })
    const ignored = new File(['text'], 'readme.txt', { lastModified: 3 })

    const books = directoryHandle('Books', [
      ['book.epub', fileHandle('book.epub', nestedEpub)],
      ['readme.txt', fileHandle('readme.txt', ignored)],
    ])
    const root = directoryHandle('Library', [
      ['root.pdf', fileHandle('root.pdf', rootPdf)],
      ['Books', books],
    ])

    const result = await discoverDocuments({
      kind: 'directory',
      source: 'directory-picker',
      handle: root,
    })

    expect(result.status).toBe('completed')
    expect(result.scanned).toBe(3)
    expect(result.documents.map((document) => document.relativePath)).toEqual([
      'root.pdf',
      'Books/book.epub',
    ])
    expect(result.documents.map((document) => document.source)).toEqual([
      'directory-picker',
      'directory-picker',
    ])
  })

  it('returns recoverable file-read problems and continues discovery', async () => {
    const good = new File(['ok'], 'good.pdf', { lastModified: 1 })
    const root = directoryHandle('Library', [
      [
        'broken.pdf',
        fileHandle('broken.pdf', new DOMException('permission lost', 'NotAllowedError')),
      ],
      ['good.pdf', fileHandle('good.pdf', good)],
    ])

    const result = await discoverDocuments({
      kind: 'directory',
      source: 'directory-picker',
      handle: root,
    })

    expect(result.status).toBe('completed')
    expect(result.scanned).toBe(2)
    expect(result.documents.map((document) => document.name)).toEqual(['good.pdf'])
    expect(result.problems).toEqual([
      {
        path: 'broken.pdf',
        code: 'read-failed',
        message: 'permission lost',
      },
    ])
  })

  it('supports cancellation with partial results and progress', async () => {
    const controller = new AbortController()
    const progress: string[] = []
    const files = [inputFile('one.pdf'), inputFile('two.pdf'), inputFile('three.epub')]

    const result = await discoverDocuments(
      {
        kind: 'files',
        source: 'file-input',
        files,
      },
      {
        signal: controller.signal,
        yieldEvery: 1,
        onProgress(update) {
          progress.push(`${update.scanned}:${update.supported}:${update.currentPath}`)
          if (update.scanned === 1) controller.abort()
        },
      },
    )

    expect(result.status).toBe('cancelled')
    expect(result.scanned).toBe(1)
    expect(result.documents.map((document) => document.name)).toEqual(['one.pdf'])
    expect(progress).toEqual(['1:1:one.pdf'])
  })

  it('reports directory enumeration errors as recoverable problems', async () => {
    const broken = {
      kind: 'directory',
      name: 'Broken',
      async *entries() {
        yield* []
        throw new DOMException('directory unavailable', 'NotReadableError')
      },
    } as unknown as FileSystemDirectoryHandle

    const selection: BrowserLibrarySelection = {
      kind: 'directory',
      source: 'directory-picker',
      handle: broken,
    }

    const result = await discoverDocuments(selection)

    expect(result.status).toBe('completed')
    expect(result.documents).toEqual([])
    expect(result.problems).toEqual([
      {
        path: 'Broken',
        code: 'enumeration-failed',
        message: 'directory unavailable',
      },
    ])
  })
})
