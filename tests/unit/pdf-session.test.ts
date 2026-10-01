import { describe, expect, it, vi } from 'vitest'
import {
  classifyPdfOpenError,
  openPdfDocument,
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
