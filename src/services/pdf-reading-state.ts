import type { PdfFitMode } from '../features/pdf/pdf-session'

export interface PdfViewSettings {
  fitMode: PdfFitMode
  zoom: number
}
export interface PdfReadingAnchor {
  page: number
  x: number
  y: number
}

export function normalizePdfAnchor(
  value?: PdfReadingAnchor,
  totalPages = Number.MAX_SAFE_INTEGER,
): PdfReadingAnchor | undefined {
  if (
    !value ||
    !Number.isInteger(value.page) ||
    value.page < 1 ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y)
  )
    return undefined
  return {
    page: Math.min(totalPages, value.page),
    x: Math.min(1, Math.max(0, value.x)),
    y: Math.min(1, Math.max(0, value.y)),
  }
}

export interface PdfReadingState {
  anchor?: PdfReadingAnchor
  page: number
  view: PdfViewSettings
}

/** Normalize persisted data at the storage boundary, including legacy page-only records. */
export function normalizePdfView(value?: Partial<PdfViewSettings>): PdfViewSettings {
  const fitMode = value?.fitMode
  return {
    fitMode: fitMode === 'page' || fitMode === 'custom' ? fitMode : 'width',
    zoom:
      typeof value?.zoom === 'number' && Number.isFinite(value.zoom)
        ? Math.min(4, Math.max(0.25, value.zoom))
        : 1,
  }
}
