import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from 'pdfjs-dist'

export type PdfFitMode = 'width' | 'page' | 'custom'

export interface PdfRenderRequest {
  canvas: HTMLCanvasElement
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

function classifyOpenError(error: unknown): PdfOpenError {
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

export class PdfDocumentSession {
  private renderTask: RenderTask | null = null
  private closed = false

  constructor(
    private readonly loadingTask: PDFDocumentLoadingTask,
    private readonly document: PDFDocumentProxy,
  ) {}

  get totalPages(): number {
    return this.document.numPages
  }

  private async cancelRender(): Promise<void> {
    const current = this.renderTask
    this.renderTask = null
    if (!current) return

    current.cancel()
    try {
      await current.promise
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'RenderingCancelledException') throw error
    }
  }

  private async getPage(pageNumber: number): Promise<PDFPageProxy> {
    if (this.closed) throw new Error('PDF session is closed.')
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > this.totalPages) {
      throw new RangeError(`Page ${pageNumber} is outside this PDF.`)
    }
    return this.document.getPage(pageNumber)
  }

  async render(request: PdfRenderRequest): Promise<PdfRenderResult> {
    await this.cancelRender()
    const page = await this.getPage(request.pageNumber)
    const baseViewport = page.getViewport({ scale: 1 })

    const widthScale =
      request.availableWidth > 0 ? request.availableWidth / baseViewport.width : request.zoom
    const pageScale =
      request.availableHeight > 0
        ? Math.min(widthScale, request.availableHeight / baseViewport.height)
        : widthScale

    const scale = clampScale(
      request.fitMode === 'width'
        ? widthScale
        : request.fitMode === 'page'
          ? pageScale
          : request.zoom,
    )
    const viewport = page.getViewport({ scale })
    const outputScale = Math.max(1, globalThis.devicePixelRatio || 1)
    const context = request.canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Canvas rendering is unavailable in this browser.')

    request.canvas.width = Math.floor(viewport.width * outputScale)
    request.canvas.height = Math.floor(viewport.height * outputScale)
    request.canvas.style.width = `${Math.floor(viewport.width)}px`
    request.canvas.style.height = `${Math.floor(viewport.height)}px`

    const transform =
      outputScale === 1 ? undefined : ([outputScale, 0, 0, outputScale, 0, 0] as const)

    const task = page.render({
      canvas: request.canvas,
      canvasContext: context,
      viewport,
      transform,
    })
    this.renderTask = task

    try {
      await task.promise
    } catch (error) {
      if (error instanceof Error && error.name === 'RenderingCancelledException') {
        throw error
      }
      throw error
    } finally {
      if (this.renderTask === task) this.renderTask = null
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
    await this.cancelRender()
    await this.document.destroy()
    await this.loadingTask.destroy()
  }
}

export async function openPdfDocument(file: File): Promise<PdfDocumentSession> {
  const pdfjs = await loadPdfJs()
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({ data })

  try {
    const document = await loadingTask.promise
    return new PdfDocumentSession(loadingTask, document)
  } catch (error) {
    await loadingTask.destroy()
    throw classifyOpenError(error)
  }
}
