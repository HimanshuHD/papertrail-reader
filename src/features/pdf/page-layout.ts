import { resolvePdfScale, type PdfFitMode } from './pdf-session'

export interface PdfPageSize {
  width: number
  height: number
}

/** Only visited pages acquire exact dimensions; distant slots use the document estimate. */
export class PdfPageLayout {
  private measured = new Map<number, PdfPageSize>()

  constructor(private readonly estimate: PdfPageSize) {}

  known(page: number) {
    return this.measured.get(page)
  }

  measure(page: number, size: PdfPageSize) {
    const old = this.measured.get(page)
    if (old?.width === size.width && old.height === size.height) return false
    this.measured.set(page, size)
    return true
  }

  size(page: number, mode: PdfFitMode, zoom: number, width: number, height: number) {
    const size = this.measured.get(page) ?? this.estimate
    const scale = resolvePdfScale(mode, zoom, size.width, size.height, width, height)
    return { width: size.width * scale, height: size.height * scale }
  }
}
