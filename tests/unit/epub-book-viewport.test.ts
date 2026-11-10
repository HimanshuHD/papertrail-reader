import { expect, it } from 'vitest'
import { sanitizeBookCSS } from '../../src/features/epub/book-styles'
import { applyBookViewport } from '../../src/features/epub/book-viewport'

it('binds approved author viewport lengths in sheets and inline declarations', () => {
  const css = sanitizeBookCSS(
    'section{margin-top:20vh;padding:calc(2vw + 1em);width:90vmin;height:50dvh} @media(min-width:500px){p{margin:2vmax}}',
  )
  expect(css).toContain('margin-top:calc(20*var(--papertrail-reader-height))')
  expect(css).toContain('calc(2*var(--papertrail-reader-width))')
  expect(css).toContain('calc(90*var(--papertrail-reader-min))')
  expect(css).toContain('calc(50*var(--papertrail-reader-height))')
  expect(css).toContain('calc(2*var(--papertrail-reader-max))')
  expect(sanitizeBookCSS('margin-top:20vh;margin-bottom:2em', undefined, true)).toContain(
    'margin-bottom:2em',
  )
  expect(sanitizeBookCSS('p{width:var(--untrusted);--papertrail-reader-height:999px}')).toBe('')
})

it('updates host-owned viewport lengths on resize and retains valid values while hidden', () => {
  const doc = document.implementation.createHTMLDocument()
  applyBookViewport(doc, 600, 800)
  expect(doc.documentElement.style.getPropertyValue('--papertrail-reader-height')).toBe('8px')
  expect(doc.documentElement.style.getPropertyValue('--papertrail-reader-min')).toBe('6px')
  applyBookViewport(doc, 900, 400)
  expect(doc.documentElement.style.getPropertyValue('--papertrail-reader-height')).toBe('4px')
  expect(doc.documentElement.style.getPropertyValue('--papertrail-reader-max')).toBe('9px')
  for (const size of [0, -1, NaN, Infinity]) applyBookViewport(doc, 600, size)
  expect(doc.documentElement.style.getPropertyValue('--papertrail-reader-height')).toBe('4px')
})
