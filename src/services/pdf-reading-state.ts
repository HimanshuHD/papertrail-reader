import type { PdfFitMode } from '../features/pdf/pdf-session'

export interface PdfViewSettings {
  fitMode: PdfFitMode
  zoom: number
}
export interface PdfReadingState {
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
