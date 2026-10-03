import { expect, it } from 'vitest'
import { normalizePdfView } from '../../src/services/pdf-reading-state'

it('reads legacy missing settings with fit-width defaults and preserves explicit fit modes', () => {
  expect(normalizePdfView()).toEqual({ fitMode: 'width', zoom: 1 })
  expect(normalizePdfView({ fitMode: 'page', zoom: 1.5 })).toEqual({ fitMode: 'page', zoom: 1.5 })
  expect(normalizePdfView({ fitMode: 'custom', zoom: 2 })).toEqual({ fitMode: 'custom', zoom: 2 })
})

it('normalizes corrupt zoom values and clamps scales to supported bounds', () => {
  expect(normalizePdfView({ zoom: NaN })).toEqual({ fitMode: 'width', zoom: 1 })
  expect(normalizePdfView({ zoom: Infinity }).zoom).toBe(1)
  expect(normalizePdfView({ zoom: -1 }).zoom).toBe(0.25)
  expect(normalizePdfView({ zoom: 99 }).zoom).toBe(4)
})
