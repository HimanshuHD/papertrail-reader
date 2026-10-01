export type ReaderFormat = 'pdf' | 'epub'

export const readerCapabilities = {
  pdf: { pagination: 'fixed', zoom: true, fontSize: false, progress: 'page' },
  epub: { pagination: 'reflowable', zoom: false, fontSize: true, progress: 'location' },
} as const

export interface ReaderNavigation {
  pdf: { page: number }
  epub: { cfi: string }
}
export interface ReaderProgress {
  pdf: { format: 'pdf'; currentPage: number; totalPages: number; percentage: number }
  epub: { format: 'epub'; cfi: string; percentage: number }
}
export interface ReaderContentsItem<F extends ReaderFormat> {
  id: string
  label: string
  target: ReaderNavigation[F]
  children?: ReaderContentsItem<F>[]
}

export interface ReaderAdapter<F extends ReaderFormat> {
  readonly format: F
  readonly capabilities: (typeof readerCapabilities)[F]
  open(file: File): Promise<void>
  close(): Promise<void>
  navigate(target: ReaderNavigation[F]): Promise<void>
  getProgress(): ReaderProgress[F] | null
  getContents(): Promise<ReaderContentsItem<F>[]>
}
export interface PdfReaderAdapter extends ReaderAdapter<'pdf'> {
  setZoom(scale: number): Promise<void>
  fit(mode: 'page' | 'width'): Promise<void>
}
export interface EpubReaderAdapter extends ReaderAdapter<'epub'> {
  setFontSize(size: number): Promise<void>
}
