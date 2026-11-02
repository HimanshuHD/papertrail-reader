import { expect, it } from 'vitest'
import { PdfPageWindow } from '../../src/features/pdf/page-window'
import { PdfPageLayout } from '../../src/features/pdf/page-layout'

it('bounds ordinary mounts to nearby pages while including distant navigation and focused pages', () => {
  const window = new PdfPageWindow()
  window.proximity(1, true)
  window.proximity(2, true)
  expect([...window.pages(900, 20)]).toEqual([1, 2, 900, 20])
  window.proximity(1, false)
  window.proximity(2, false)
  window.proximity(900, true)
  window.proximity(901, true)
  expect([...window.pages(900)]).toEqual([900, 901])
})

it('pins traversed pages during a drag, keeps backwards selections and releases collapsed selections', () => {
  const window = new PdfPageWindow()
  window.proximity(1, true)
  window.beginSelection()
  window.proximity(1, false)
  window.proximity(2, true)
  window.proximity(2, false)
  window.proximity(3, true)
  window.selection()
  expect([...window.pages(3)]).toEqual([3, 1, 2])
  window.endSelection()
  window.selection(3, 1)
  window.proximity(3, false)
  expect([...window.pages(20)]).toEqual([1, 2, 3, 20])
  window.selection()
  expect([...window.pages(20)]).toEqual([20])
})

it('retains measured page geometry independently of mounts and scales estimates without loading pages', () => {
  const layout = new PdfPageLayout({ width: 600, height: 800 })
  expect(layout.known(900)).toBeUndefined()
  expect(layout.size(900, 'width', 1, 300, 1000)).toEqual({ width: 300, height: 400 })
  expect(layout.measure(900, { width: 800, height: 400 })).toBe(true)
  expect(layout.measure(900, { width: 800, height: 400 })).toBe(false)
  expect(layout.size(900, 'width', 1, 300, 1000)).toEqual({ width: 300, height: 150 })
  expect(layout.size(900, 'custom', 2, 300, 1000)).toEqual({ width: 1600, height: 800 })
  expect(layout.size(899, 'width', 1, 300, 1000)).toEqual({ width: 300, height: 400 })
})
