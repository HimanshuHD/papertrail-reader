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

describe('PDF render and session lifecycle', () => {
  function deferred() {
    let resolve!: () => void
    let reject!: (error: Error) => void
    const promise = new Promise<void>((yes, no) => {
      resolve = yes
      reject = no
    })
    return { promise, resolve, reject }
  }

  function makeRenderer() {
    const tasks: {
      promise: Promise<void>
      cancel: ReturnType<typeof vi.fn>
      resolve: () => void
    }[] = []
    const layers: { cancel: ReturnType<typeof vi.fn>; resolve: () => void }[] = []
    const render = vi.fn(() => {
      const pending = deferred()
      const cancel = vi.fn(() => {
        const error = new Error('render cancelled')
        error.name = 'RenderingCancelledException'
        pending.reject(error)
      })
      const task = { ...pending, cancel }
      tasks.push(task)
      return task
    })
    const page = {
      getViewport: ({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
        scale,
      }),
      render,
      getTextContent: vi.fn().mockResolvedValue({ items: [] }),
      cleanup: vi.fn(),
    }
    const documentProxy = {
      numPages: 2,
      getPage: vi.fn().mockResolvedValue(page),
      cleanup: vi.fn().mockResolvedValue(undefined),
    }
    const loadingTask = { destroy: vi.fn().mockResolvedValue(undefined) }
    class TextLayer {
      private pending = deferred()
      constructor() {
        layers.push({ cancel: this.cancel, resolve: this.pending.resolve })
      }
      render() {
        return this.pending.promise
      }
      cancel = vi.fn(() => this.pending.reject(new Error('TextLayer task cancelled.')))
    }
    const session = new PdfDocumentSession(
      { TextLayer } as unknown as typeof import('pdfjs-dist'),
      loadingTask as never,
      documentProxy as never,
    )
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue({} as CanvasRenderingContext2D)
    const request = {
      canvas,
      pageNumber: 1,
      fitMode: 'width' as const,
      zoom: 1,
      availableWidth: 600,
      availableHeight: 800,
    }
    return { session, request, tasks, layers, page, documentProxy, loadingTask }
  }

  it('cancels an obsolete canvas render before starting its replacement', async () => {
    const { session, request, tasks, page } = makeRenderer()
    const first = session.render(request)
    const cancelled = expect(first).rejects.toMatchObject({ name: 'RenderingCancelledException' })
    await vi.waitFor(() => expect(tasks).toHaveLength(1))
    const second = session.render({ ...request, zoom: 2, fitMode: 'custom' })
    await vi.waitFor(() => expect(tasks).toHaveLength(2))
    await cancelled
    expect(tasks[0]!.cancel).toHaveBeenCalledOnce()
    tasks[1]!.resolve()
    await expect(second).resolves.toMatchObject({ scale: 2 })
    expect(page.cleanup).toHaveBeenCalledTimes(2)
    await session.close()
  })

  it('cancels an active text layer on close and releases resources only once', async () => {
    const { session, request, tasks, layers, documentProxy, loadingTask } = makeRenderer()
    const rendering = session.render({ ...request, textLayer: document.createElement('div') })
    const cancelled = expect(rendering).rejects.toThrow('TextLayer task cancelled.')
    await vi.waitFor(() => expect(tasks).toHaveLength(1))
    tasks[0]!.resolve()
    await vi.waitFor(() => expect(layers).toHaveLength(1))
    await session.close()
    await cancelled
    expect(layers[0]!.cancel).toHaveBeenCalledOnce()
    expect(documentProxy.cleanup).toHaveBeenCalledOnce()
    expect(loadingTask.destroy).toHaveBeenCalledOnce()
    await session.close()
    expect(loadingTask.destroy).toHaveBeenCalledOnce()
    await expect(session.render(request)).rejects.toThrow('PDF session is closed.')
  })

  it('cancels pending canvas work before document teardown', async () => {
    const { session, request, tasks, documentProxy, loadingTask } = makeRenderer()
    const rendering = session.render(request)
    const cancelled = expect(rendering).rejects.toMatchObject({
      name: 'RenderingCancelledException',
    })
    await vi.waitFor(() => expect(tasks).toHaveLength(1))
    await session.close()
    await cancelled
    expect(tasks[0]!.cancel).toHaveBeenCalledOnce()
    expect(documentProxy.cleanup).toHaveBeenCalledOnce()
    expect(loadingTask.destroy).toHaveBeenCalledOnce()
    expect(tasks[0]!.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      documentProxy.cleanup.mock.invocationCallOrder[0]!,
    )
    expect(documentProxy.cleanup.mock.invocationCallOrder[0]).toBeLessThan(
      loadingTask.destroy.mock.invocationCallOrder[0]!,
    )
  })
})

describe('local preview preparation', () => {
  it('preloads every page, bounds preview pixels, reports progress and releases the cache', async () => {
    const context = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({} as CanvasRenderingContext2D)
    const page = {
      getViewport: ({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
        scale,
      }),
      render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
      cleanup: vi.fn(),
    }
    const documentProxy = {
      numPages: 4,
      getPage: vi.fn().mockResolvedValue(page),
      cleanup: vi.fn().mockResolvedValue(undefined),
    }
    const loadingTask = { destroy: vi.fn().mockResolvedValue(undefined) }
    const session = new PdfDocumentSession(
      {} as typeof import('pdfjs-dist'),
      loadingTask as never,
      documentProxy as never,
    )
    const progress = vi.fn()
    await session.preload(progress)
    const previews = Array.from({ length: 4 }, (_, i) => session.getPagePreview(i + 1)!)
    expect(previews.every(Boolean)).toBe(true)
    expect(
      previews.reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0),
    ).toBeLessThanOrEqual(32 * 1024 * 1024)
    expect(progress.mock.calls).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ])
    const requests = documentProxy.getPage.mock.calls.length
    await expect(session.getPageDimensions(4)).resolves.toEqual({ width: 600, height: 800 })
    expect(documentProxy.getPage).toHaveBeenCalledTimes(requests)
    await session.close()
    expect(session.getPagePreview(4)).toBeUndefined()
    expect(previews.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true)
    context.mockRestore()
  })
})
