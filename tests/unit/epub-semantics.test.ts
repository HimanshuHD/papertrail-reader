import { expect, it } from 'vitest'
import { sanitizeBookCSS } from '../../src/features/epub/book-styles'
import { sanitizeChapter } from '../../src/features/epub/publication'
import { EPUB_NAMESPACE } from '../../src/features/epub/book-semantics'

function chapter() {
  return new DOMParser().parseFromString(
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:book="${EPUB_NAMESPACE}" xml:lang="en-GB"><head/><body book:type="bodymatter"><section book:type="chapter" id="section"><hgroup><h2>V</h2><p book:type="title">Generated Chapter Heading</p></hgroup><p>Readable body.</p></section></body></html>`,
    'application/xml',
  )
}
it('preserves heading groups and mirrors inert semantic metadata in formatted and text-only modes', () => {
  for (const formatting of [
    undefined,
    { sheets: [], images: new Map<Element, string>(), inline: new Map<Element, string>() },
  ]) {
    const markup = sanitizeChapter(chapter(), formatting)
    const doc = new DOMParser().parseFromString(markup, 'application/xml')
    expect(doc.querySelector('hgroup > h2')?.textContent).toBe('V')
    expect(doc.querySelector('hgroup > p')?.textContent).toBe('Generated Chapter Heading')
    expect(doc.querySelector('section')?.getAttributeNS(EPUB_NAMESPACE, 'type')).toBe('chapter')
    expect(doc.querySelector('section')?.getAttribute('data-reader-epub-type')).toBe('chapter')
    expect(doc.documentElement.getAttribute('lang')).toBe('en-GB')
    // HTML srcdoc loses XML attribute namespaces, but the owned mirror still matches.
    const html = new DOMParser().parseFromString(markup, 'text/html')
    expect(html.querySelector('[data-reader-epub-type~="chapter"] hgroup p')?.textContent).toBe(
      'Generated Chapter Heading',
    )
  }
})
it('normalizes approved namespace aliases while keeping caps, numeric and feature declarations', () => {
  const css = sanitizeBookCSS(
    `@namespace book "${EPUB_NAMESPACE}";@namespace xml "http://www.w3.org/XML/1998/namespace";[book|type~="title"]{font-variant-caps:small-caps;font-variant-numeric:oldstyle-nums;font-feature-settings:"smcp" 1;text-align:center}[xml|lang|="en"]{font-weight:700}`,
  )
  expect(css).toContain('[data-reader-epub-type~=')
  expect(css).toContain('[data-reader-xml-lang|=')
  expect(css).toContain('font-variant-caps:small-caps')
  expect(css).toContain('font-variant-numeric:oldstyle-nums')
  expect(css).toContain('font-feature-settings:')
  expect(css).toContain('text-align:center')
  expect(css).not.toContain('[book|type')
})
it('omits unsupported namespaces without broadening their selectors or admitting active declarations', () => {
  const css = sanitizeBookCSS(
    '@namespace bad "https://invalid.example/ns";[bad|type]{color:red}p{color:blue;background-image:url(https://invalid.example/image);position:fixed}',
  )
  expect(css).toContain('color:blue')
  expect(css).not.toMatch(/invalid|color:red|position:fixed/)
  expect(sanitizeBookCSS('@namespace "https://invalid.example/ns";p{color:red}')).toBe('')
})
it('preserves bounded safe supports rules without accepting resource URLs in their conditions', () => {
  expect(
    sanitizeBookCSS('@supports(display:flex){hgroup{display:flex;text-align:center}}'),
  ).toContain('@supports')
  expect(
    sanitizeBookCSS('@supports(background:url(https://invalid.example/x)){p{color:red}}'),
  ).not.toContain('invalid.example')
})
