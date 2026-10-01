import { expectTypeOf, it } from 'vitest'
import type { PdfReaderAdapter, EpubReaderAdapter, ReaderProgress } from '../../src/types/reader'

it('keeps PDF page navigation distinct from EPUB CFI locations and supported controls', () => {
  expectTypeOf<PdfReaderAdapter['navigate']>().parameter(0).toEqualTypeOf<{ page: number }>()
  expectTypeOf<EpubReaderAdapter['navigate']>().parameter(0).toEqualTypeOf<{ cfi: string }>()
  expectTypeOf<PdfReaderAdapter['getProgress']>().returns.toEqualTypeOf<
    ReaderProgress['pdf'] | null
  >()
  expectTypeOf<EpubReaderAdapter['getProgress']>().returns.toEqualTypeOf<
    ReaderProgress['epub'] | null
  >()
  expectTypeOf<PdfReaderAdapter>().toHaveProperty('setZoom')
  expectTypeOf<EpubReaderAdapter>().toHaveProperty('setFontSize')
  expectTypeOf<EpubReaderAdapter>().not.toHaveProperty('setZoom')
  expectTypeOf<PdfReaderAdapter>().not.toHaveProperty('setFontSize')
})
