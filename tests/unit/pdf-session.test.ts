import { describe, expect, it, vi } from 'vitest'
import {
  classifyPdfOpenError,
  openPdfDocument,
  PdfDocumentSession,
  PdfOpenError,
  resolvePdfScale,
} from '../../src/features/pdf/pdf-session'

describe('PDF scale resolution', () => {
  it('fits width and page against the available viewport', () => {
    expect(resolvePdfScale('width', 1, 600, 800, 900, 700)).toBe(1.5)
    expect(resolvePdfScale('page', 1, 600, 800, 900, 700)).toBe(0.875)
  })

  it('uses custom zoom and clamps extreme scales', () => {
    expect(resolvePdfScale('custom', 1.75, 600, 800, 900, 700)).toBe(1.75)
    expect(resolvePdfScale('custom', 0.01, 600, 800, 900, 700)).toBe(0.25)
    expect(resolvePdfScale('custom', 10, 600, 800, 900, 700)).toBe(4)
  })
})

describe('PDF open recovery', () => {
  it('maps malformed PDF errors to a recoverable invalid state', () => {
    const source = new Error('Invalid PDF structure.')
    source.name = 'InvalidPDFException'

    expect(classifyPdfOpenError(source)).toMatchObject({
      code: 'invalid',
      message: 'This file is not a valid or supported PDF.',
    })
  })

  it('fails fast when PDF.js requests a password and destroys the loading task', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined)
    let passwordCallback: (() => void) | null = null
    const pending = new Promise<never>(() => undefined)
    const loadingTask = {
      promise: pending,
      destroy,
      set onPassword(callback: (() => void) | null) {
        passwordCallback = callback
        if (callback) queueMicrotask(callback)
      },
      get onPassword() {
        return passwordCallback
      },
    }

    const loader = async () =>
      ({
        getDocument: () => loadingTask,
      }) as unknown as typeof import('pdfjs-dist')

    const file = new File(['password protected fixture'], 'locked.pdf', {
      type: 'application/pdf',
    })

    await expect(openPdfDocument(file, loader)).rejects.toMatchObject({
      code: 'password-required',
      message: 'This PDF is password protected. Password entry is not available yet.',
    })
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('preserves already classified reader errors', () => {
    const error = new PdfOpenError('missing', 'gone')
    expect(classifyPdfOpenError(error)).toBe(error)
  })
})

describe('PDF search and contents', () => {
  function makeSession(pages: string[], outline: unknown[] = []) {
    const getPage = vi.fn(async (pageNumber: number) => ({
      getTextContent: vi.fn().mockResolvedValue({
        items: pages[pageNumber - 1].split(' ').map((str) => ({ str })),
      }),
    }))
    const getOutline = vi.fn().mockResolvedValue(outline)
    const getDestination = vi.fn(async (name: string) =>
      name === 'chapter-two' ? [{ num: 2, gen: 0 }, { name: 'XYZ' }] : null,
    )
    const getPageIndex = vi.fn(async () => 1)
    const document = {
      numPages: pages.length,
      getPage,
      getOutline,
      getDestination,
      getPageIndex,
      cleanup: vi.fn().mockResolvedValue(undefined),
    }
    const loadingTask = { destroy: vi.fn().mockResolvedValue(undefined) }
    const pdfjs = {}

    return {
      session: new PdfDocumentSession(
        pdfjs as unknown as typeof import('pdfjs-dist'),
        loadingTask as never,
        document as never,
      ),
      getPage,
      getDestination,
      getPageIndex,
    }
  }

  it('finds case-insensitive text matches with page snippets', async () => {
    const { session } = makeSession([
      'PaperTrail starts here',
      'Another papertrail result and PaperTrail again',
      '',
    ])

    const result = await session.searchText('papertrail')

    expect(result.textPageCount).toBe(2)
    expect(result.truncated).toBe(false)
    expect(result.matches.map((match) => [match.pageNumber, match.occurrence])).toEqual([
      [1, 1],
      [2, 1],
      [2, 2],
    ])
    expect(result.matches[0]?.excerpt).toContain('PaperTrail starts here')
  })

  it('reports image-only/no-text PDFs without inventing search matches', async () => {
    const { session } = makeSession(['', ''])

    await expect(session.searchText('anything')).resolves.toEqual({
      matches: [],
      textPageCount: 0,
      truncated: false,
    })
  })

  it('resolves named outline destinations to one-based page numbers', async () => {
    const { session, getDestination, getPageIndex } = makeSession(
      ['one', 'two'],
      [
        {
          title: 'Chapter two',
          dest: 'chapter-two',
          items: [],
        },
      ],
    )

    await expect(session.getOutline()).resolves.toEqual([
      {
        title: 'Chapter two',
        pageNumber: 2,
        children: [],
      },
    ])
    expect(getDestination).toHaveBeenCalledWith('chapter-two')
    expect(getPageIndex).toHaveBeenCalled()
  })
})
