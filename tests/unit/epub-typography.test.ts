import { expect, it } from 'vitest'
import {
  DEFAULT_EPUB_TYPOGRAPHY,
  normalizeTypography,
  readingWidthOptions,
  fontSteps,
  typographyCSS,
} from '../../src/features/epub/typography'

it('validates every typography value before generating reader CSS', () => {
  expect(normalizeTypography({ fontSize: NaN, lineSpacing: -1, readingWidth: 999999 })).toEqual(
    DEFAULT_EPUB_TYPOGRAPHY,
  )
  expect(normalizeTypography({ fontSize: 22, lineSpacing: 1.8, readingWidth: 640 })).toEqual({
    fontSize: 22,
    lineSpacing: 1.8,
    readingWidth: 640,
  })
  const css = typographyCSS({ fontSize: 22, lineSpacing: 1.8, readingWidth: 640 })
  expect(css).toContain('font-size:22px!important')
  expect(css).toContain('line-height:1.8!important')
  expect(css).toContain('max-width:min(70%,768px)!important')
  expect(css).not.toMatch(/color|background|display|url/)
})

it('returns a replaceable empty sheet on reset, removing all explicit overrides', () => {
  expect(typographyCSS(DEFAULT_EPUB_TYPOGRAPHY)).toBe(':root{}')
  expect(typographyCSS({ fontSize: null, lineSpacing: 1.4, readingWidth: null })).not.toContain(
    'font-size:',
  )
})

it('uses mobile/tablet/desktop choices and separates wide from full width', () => {
  expect(readingWidthOptions(390)).toEqual([])
  expect(readingWidthOptions(800).map((option) => option.label)).toEqual([
    'Full width',
    'Narrow',
    'Medium',
  ])
  expect(readingWidthOptions(1280).map((option) => option.label)).toEqual([
    'Full width',
    'Narrow',
    'Medium',
    'Wide',
  ])
  expect(typographyCSS({ fontSize: null, lineSpacing: null, readingWidth: 800 })).toContain(
    'min(90%,1100px)',
  )
  expect(fontSteps(16).filter((step) => step.size === 16)).toEqual([{ size: 16, value: null }])
  expect(fontSteps(17).find((step) => step.value === null)?.size).toBe(17)
})
