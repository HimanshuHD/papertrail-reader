import { expect, it } from 'vitest'
import {
  DEFAULT_EPUB_TYPOGRAPHY,
  normalizeTypography,
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
  expect(css).toContain('max-width:min(100%,640px)!important')
  expect(css).not.toMatch(/color|background|display|url/)
})

it('returns a replaceable empty sheet on reset, removing all explicit overrides', () => {
  expect(typographyCSS(DEFAULT_EPUB_TYPOGRAPHY)).toBe(':root{}')
  expect(typographyCSS({ fontSize: null, lineSpacing: 1.4, readingWidth: null })).not.toContain(
    'font-size:',
  )
})
