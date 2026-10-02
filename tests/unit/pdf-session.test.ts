import { describe, expect, it, vi } from 'vitest'
import {
  classifyPdfOpenError,
  openPdfDocument,
  readPdfTitle,
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

describe('demand-driven PDF preparation', () => {
  it('opens a 1,001-page document after measuring only its first page, without rasterization', async () => {
    const page = {
      getViewport: () => ({ width: 600, height: 800 }),
      render: vi.fn(),
    }
    const documentProxy = {
      numPages: 1001,
      getPage: vi.fn().mockResolvedValue(page),
      cleanup: vi.fn().mockResolvedValue(undefined),
    }
    const loadingTask = {
      promise: Promise.resolve(documentProxy),
      destroy: vi.fn().mockResolvedValue(undefined),
    }
    const loader = async () =>
      ({ getDocument: () => loadingTask }) as unknown as typeof import('pdfjs-dist')
    const session = await openPdfDocument(new File(['fixture'], 'long.pdf'), loader)
    expect(session.totalPages).toBe(1001)
    expect(documentProxy.getPage.mock.calls).toEqual([[1]])
    expect(page.render).not.toHaveBeenCalled()
    expect(session.defaultPageDimensions).toEqual({ width: 600, height: 800 })
    await session.getPageDimensions(1)
    expect(documentProxy.getPage).toHaveBeenCalledOnce()
    await session.close()
  })

  it('bounds reusable preview pixels with LRU eviction and releases them on close', async () => {
    const context = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
    const session = new PdfDocumentSession(
      {} as typeof import('pdfjs-dist'),
      { destroy: vi.fn().mockResolvedValue(undefined) } as never,
      { numPages: 1001, cleanup: vi.fn().mockResolvedValue(undefined) } as never,
    )
    const source = document.createElement('canvas')
    source.width = 1200
    source.height = 1600
    session.cachePagePreview(1, source)
    session.cachePagePreview(2, source)
    const evicted = session.getPagePreview(2)!
    for (let n = 3; n <= 128; n += 1) session.cachePagePreview(n, source)
    session.getPagePreview(1) // Retain the recently visited first page.
    session.cachePagePreview(129, source)
    expect(session.getPagePreview(1)).toBeDefined()
    expect(session.getPagePreview(2)).toBeUndefined()
    expect(evicted.width).toBe(0)
    const previews = Array.from({ length: 129 }, (_, i) => session.getPagePreview(i + 1)).filter(
      (v): v is HTMLCanvasElement => Boolean(v),
    )
    expect(previews).toHaveLength(128)
    expect(
      previews.reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0),
    ).toBeLessThan(18 * 1024 * 1024)
    await session.close()
    expect(previews.every((canvas) => canvas.width === 0 && canvas.height === 0)).toBe(true)
    context.mockRestore()
  })
})

describe('local PDF title metadata', () => {
  it.each([
    ['  A\nquiet chapter  ', 'File title', 'A quiet chapter'],
    ['Untitled', '  Embedded title  ', 'Embedded title'],
    [null, '', null],
    [null, 'Untitled', null],
  ])('chooses a usable metadata title (%s, %s)', async (xmp, info, expected) => {
    const proxy = {
      getMetadata: vi
        .fn()
        .mockResolvedValue({ info: { Title: info }, metadata: { get: () => xmp } }),
      getPage: vi.fn(),
    }
    const task = { promise: Promise.resolve(proxy), destroy: vi.fn().mockResolvedValue(undefined) }
    const loader = async () =>
      ({ getDocument: () => task }) as unknown as typeof import('pdfjs-dist')
    expect(await readPdfTitle(new File(['fixture'], 'file.pdf'), undefined, loader)).toBe(expected)
    expect(proxy.getPage).not.toHaveBeenCalled()
    expect(task.destroy).toHaveBeenCalledOnce()
  })
  it('falls back safely on invalid files and stops before reading cancelled selections', async () => {
    const task = {
      promise: Promise.resolve(null),
      destroy: vi.fn().mockResolvedValue(undefined),
    }
    const loader = vi.fn(
      async () =>
        ({
          getDocument: () => ({ ...task, promise: Promise.reject(new Error('Invalid PDF')) }),
        }) as unknown as typeof import('pdfjs-dist'),
    )
    expect(await readPdfTitle(new File(['bad'], 'bad.pdf'), undefined, loader)).toBeNull()
    expect(task.destroy).toHaveBeenCalledOnce()
    const controller = new AbortController()
    controller.abort()
    expect(await readPdfTitle(new File(['bad'], 'bad.pdf'), controller.signal, loader)).toBeNull()
    expect(loader).toHaveBeenCalledOnce()
  })
})
