import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'

export type PdfFitMode = 'width' | 'page' | 'custom'

export interface PdfRenderRequest {
  canvas: HTMLCanvasElement
  textLayer?: HTMLElement
  pageNumber: number
  fitMode: PdfFitMode
  zoom: number
  availableWidth: number
  availableHeight: number
}

export interface PdfRenderResult {
  scale: number
  width: number
  height: number
}

export interface PdfOutlineItem {
  title: string
  pageNumber: number | null
  children: readonly PdfOutlineItem[]
}

export interface PdfSearchMatch {
  pageNumber: number
  excerpt: string
  occurrence: number
}

export interface PdfSearchResult {
  matches: readonly PdfSearchMatch[]
  textPageCount: number
  truncated: boolean
}

export type PdfOpenErrorCode = 'password-required' | 'invalid' | 'missing' | 'unknown'

export class PdfOpenError extends Error {
  constructor(
    public readonly code: PdfOpenErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'PdfOpenError'
  }
}

type PdfJsModule = typeof import('pdfjs-dist')
type PdfJsLoader = () => Promise<PdfJsModule>
type ActiveTextLayer = { cancel?: () => void }
type ActiveRender = {
  renderTask: RenderTask | null
  textLayer: ActiveTextLayer | null
}

let pdfJsPromise: Promise<PdfJsModule> | null = null

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
  }

  return pdfJsPromise
}

export function classifyPdfOpenError(error: unknown): PdfOpenError {
  if (error instanceof PdfOpenError) return error

  if (error instanceof Error) {
    if (error.name === 'PasswordException') {
      return new PdfOpenError(
        'password-required',
        'This PDF is password protected. Password entry is not available yet.',
        { cause: error },
      )
    }

    if (error.name === 'InvalidPDFException') {
      return new PdfOpenError('invalid', 'This file is not a valid or supported PDF.', {
        cause: error,
      })
    }

    if (error.name === 'MissingPDFException') {
      return new PdfOpenError('missing', 'The selected PDF is no longer available.', {
        cause: error,
      })
    }

    return new PdfOpenError('unknown', error.message || 'PaperTrail could not open this PDF.', {
      cause: error,
    })
  }

  return new PdfOpenError('unknown', 'PaperTrail could not open this PDF.')
}

function clampScale(scale: number): number {
  return Math.min(4, Math.max(0.25, scale))
}

export function resolvePdfScale(
  fitMode: PdfFitMode,
  zoom: number,
  pageWidth: number,
  pageHeight: number,
  availableWidth: number,
  availableHeight: number,
): number {
  const widthScale = availableWidth > 0 ? availableWidth / pageWidth : zoom
  const pageScale =
    availableHeight > 0 ? Math.min(widthScale, availableHeight / pageHeight) : widthScale

  return clampScale(fitMode === 'width' ? widthScale : fitMode === 'page' ? pageScale : zoom)
}

export class PdfDocumentSession {
  private readonly activeRenders = new Map<HTMLCanvasElement, ActiveRender>()
  private closed = false

  constructor(
    private readonly pdfjs: PdfJsModule,
    private readonly loadingTask: PDFDocumentLoadingTask,
    private readonly document: PDFDocumentProxy,
  ) {}

  get totalPages(): number {
    return this.document.numPages
  }

  async getPageDimensions(pageNumber: number): Promise<{ width: number; height: number }> {
    const page = await this.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    return { width: viewport.width, height: viewport.height }
  }

  private async cancelRender(canvas: HTMLCanvasElement): Promise<void> {
    const current = this.activeRenders.get(canvas)
    this.activeRenders.delete(canvas)
    if (!current) return

    current.textLayer?.cancel?.()
    const task = current.renderTask
    if (!task) return

    task.cancel()
    try {
      await task.promise
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'RenderingCancelledException') throw error
    }
  }

  private async cancelAllRenders(): Promise<void> {
    await Promise.all([...this.activeRenders.keys()].map((canvas) => this.cancelRender(canvas)))
  }

  private async getPage(pageNumber: number): Promise<PDFPageProxy> {
    if (this.closed) throw new Error('PDF session is closed.')
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > this.totalPages) {
      throw new RangeError(`Page ${pageNumber} is outside this PDF.`)
    }
    return this.document.getPage(pageNumber)
  }

  private async resolveDestinationPage(
    destination: string | unknown[] | null | undefined,
  ): Promise<number | null> {
    if (!destination) return null

    try {
      const resolved =
        typeof destination === 'string'
          ? await this.document.getDestination(destination)
          : destination
      if (!resolved?.length) return null

      const target = resolved[0]
      if (typeof target === 'number') return target + 1
      if (target && typeof target === 'object') {
        return (
          (await this.document.getPageIndex(
            target as Parameters<PDFDocumentProxy['getPageIndex']>[0],
          )) + 1
        )
      }
    } catch {
      return null
    }

    return null
  }

  async getOutline(): Promise<readonly PdfOutlineItem[]> {
    if (this.closed) throw new Error('PDF session is closed.')
    const outline = await this.document.getOutline()
    if (!outline) return []

    const convert = async (
      items: Awaited<ReturnType<PDFDocumentProxy['getOutline']>>,
    ): Promise<readonly PdfOutlineItem[]> => {
      if (!items) return []

      return Promise.all(
        items.map(async (item) => ({
          title: item.title || 'Untitled section',
          pageNumber: await this.resolveDestinationPage(item.dest),
          children: await convert(item.items),
        })),
      )
    }

    return convert(outline)
  }

  async searchText(
    query: string,
    options: { signal?: AbortSignal; maxMatches?: number } = {},
  ): Promise<PdfSearchResult> {
    if (this.closed) throw new Error('PDF session is closed.')

    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return { matches: [], textPageCount: 0, truncated: false }

    const maxMatches = Math.max(1, options.maxMatches ?? 200)
    const matches: PdfSearchMatch[] = []
    let textPageCount = 0
    let truncated = false

    for (let pageNumber = 1; pageNumber <= this.totalPages; pageNumber += 1) {
      if (options.signal?.aborted) throw new DOMException('Search cancelled.', 'AbortError')

      const page = await this.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (!text) continue
      textPageCount += 1

      const haystack = text.toLocaleLowerCase()
      let offset = 0
      let occurrence = 0

      while (offset <= haystack.length - needle.length) {
        const index = haystack.indexOf(needle, offset)
        if (index < 0) break

        occurrence += 1
        const excerptStart = Math.max(0, index - 55)
        const excerptEnd = Math.min(text.length, index + needle.length + 75)
        const prefix = excerptStart > 0 ? '…' : ''
        const suffix = excerptEnd < text.length ? '…' : ''

        matches.push({
          pageNumber,
          occurrence,
          excerpt: `${prefix}${text.slice(excerptStart, excerptEnd)}${suffix}`,
        })

        if (matches.length >= maxMatches) {
          truncated = true
          return { matches, textPageCount, truncated }
        }

        offset = index + Math.max(needle.length, 1)
      }
    }

    return { matches, textPageCount, truncated }
  }

  async render(request: PdfRenderRequest): Promise<PdfRenderResult> {
    await this.cancelRender(request.canvas)
    const page = await this.getPage(request.pageNumber)
    const baseViewport = page.getViewport({ scale: 1 })

    const scale = resolvePdfScale(
      request.fitMode,
      request.zoom,
      baseViewport.width,
      baseViewport.height,
      request.availableWidth,
      request.availableHeight,
    )
    const viewport = page.getViewport({ scale })
    const outputScale = Math.max(1, globalThis.devicePixelRatio || 1)
    const context = request.canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Canvas rendering is unavailable in this browser.')

    request.canvas.width = Math.floor(viewport.width * outputScale)
    request.canvas.height = Math.floor(viewport.height * outputScale)
    request.canvas.style.width = `${Math.floor(viewport.width)}px`
    request.canvas.style.height = `${Math.floor(viewport.height)}px`

    if (request.textLayer) {
      request.textLayer.replaceChildren()
      request.textLayer.style.width = `${Math.floor(viewport.width)}px`
      request.textLayer.style.height = `${Math.floor(viewport.height)}px`
      request.textLayer.style.setProperty('--scale-factor', String(viewport.scale))
      request.textLayer.style.setProperty('--total-scale-factor', String(viewport.scale))
    }

    const transform = outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
    const task = page.render({
      canvas: request.canvas,
      canvasContext: context,
      background: '#ffffff',
      viewport,
      transform,
    })
    const active: ActiveRender = { renderTask: task, textLayer: null }
    this.activeRenders.set(request.canvas, active)

    try {
      await task.promise
      active.renderTask = null

      if (request.textLayer) {
        const textContent = await page.getTextContent()
        const textLayer = new this.pdfjs.TextLayer({
          textContentSource: textContent,
          container: request.textLayer,
          viewport,
        })
        active.textLayer = textLayer
        await textLayer.render()
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'RenderingCancelledException') throw error
      if (error instanceof Error && error.message === 'TextLayer task cancelled.') throw error
      throw error
    } finally {
      if (this.activeRenders.get(request.canvas) === active) {
        this.activeRenders.delete(request.canvas)
      }
      page.cleanup()
    }

    return {
      scale,
      width: viewport.width,
      height: viewport.height,
    }
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.cancelAllRenders()
    await this.document.cleanup()
    await this.loadingTask.destroy()
  }
}

export async function openPdfDocument(
  file: File,
  loader: PdfJsLoader = loadPdfJs,
): Promise<PdfDocumentSession> {
  const pdfjs = await loader()
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({ data })

  const passwordRequest = new Promise<never>((_resolve, reject) => {
    loadingTask.onPassword = () => {
      reject(
        new PdfOpenError(
          'password-required',
          'This PDF is password protected. Password entry is not available yet.',
        ),
      )
    }
  })

  try {
    const document = await Promise.race([loadingTask.promise, passwordRequest])
    return new PdfDocumentSession(pdfjs, loadingTask, document)
  } catch (error) {
    await loadingTask.destroy()
    throw classifyPdfOpenError(error)
  }
}
