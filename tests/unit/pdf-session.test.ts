import { describe, expect, it } from 'vitest'
import { resolvePdfScale } from '../../src/features/pdf/pdf-session'

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
