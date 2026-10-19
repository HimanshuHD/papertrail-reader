import { Blob } from 'node:buffer'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { afterEach, expect, it, vi } from 'vitest'
import { createFormattedEpubFixture } from '../fixtures/epub'
import { sanitizeBookCSS, stylesheetURLs } from '../../src/features/epub/book-styles'
import { verifyBookImage } from '../../src/features/epub/book-images'
import { preparePublication } from '../../src/features/epub/publication'

afterEach(() => vi.unstubAllGlobals())
const blob = (bytes: Uint8Array) => new Blob([bytes]) as unknown as globalThis.Blob
function urls() {
  const create = vi.fn(() => 'blob:local-image')
  const revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  return { create, revoke }
}

it('preserves approved CSS layout and colors while dropping active and remote CSS', () => {
  const css = sanitizeBookCSS(
    '@import url(https://evil.invalid/a); @font-face{src:url(a)} .book{color:#123456;text-align:center;display:grid;grid-template-columns:repeat(2,1fr);background:url(local.svg);position:fixed;behavior:url(x);width:expression(alert(1))} @media(max-width:400px){.book{margin:2px}}',
    new Map([['local.svg', 'blob:local-image']]),
  )
  expect(css).toContain('color:#123456')
  expect(css).toContain('grid-template-columns:repeat(2,1fr)')
  expect(css).toContain('url(blob:local-image)')
  expect(css).toContain('@media')
  expect(css).not.toMatch(/import|font-face|evil|position|behavior|expression/)
  expect(sanitizeBookCSS('background:url(https://evil.invalid/x);color:red', undefined, true)).toBe(
    'color:red',
  )
  expect(stylesheetURLs('p{background:url("images/local.svg")}')).toEqual(['images/local.svg'])
  expect(() => sanitizeBookCSS('x'.repeat(256 * 1024 + 1))).toThrow('budget')
})

it('rebuilds SVG without scripts, foreign content, event handlers or resource URLs', () => {
  const bytes = verifyBookImage(
    strToU8(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" onload="attack()"><script>attack()</script><foreignObject><p>bad</p></foreignObject><image href="https://evil.invalid/x"/><use href="https://evil.invalid/x"/><rect width="20" height="10" fill="url(https://evil.invalid/x)"/><circle r="2" fill="red"/></svg>',
    ),
    'image/svg+xml',
  )!
  const safe = strFromU8(bytes)
  expect(safe).toContain('fill="red"')
  expect(safe).not.toMatch(/attack|foreignObject|evil|<image|onload/)
  expect(
    verifyBookImage(strToU8('<!DOCTYPE svg [<!ENTITY x SYSTEM "x">]><svg/>'), 'image/svg+xml'),
  ).toBeNull()
  expect(
    verifyBookImage(strToU8('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/png'),
  ).toBeNull()
  expect(() =>
    verifyBookImage(
      strToU8('<svg xmlns="http://www.w3.org/2000/svg" width="10000"/>'),
      'image/svg+xml',
    ),
  ).toThrow('budget')
})

it('defaults to local author formatting, owns image URLs and uses the same anchors in text-only view', async () => {
  const { create, revoke } = urls()
  const file = blob(createFormattedEpubFixture())
  const formatted = await preparePublication(file)
  const chapter = strFromU8(unzipSync(new Uint8Array(formatted.bytes))['chapter-0.xhtml']!)
  expect(chapter).toContain('text-align:center')
  expect(chapter).toContain('letter-spacing:1px')
  expect(chapter).toContain('color:#123456')
  expect(chapter).toContain('src="blob:local-image"')
  expect(chapter).toContain('img-src blob:')
  expect(create).toHaveBeenCalledOnce()
  const text = await preparePublication(file, undefined, true)
  const plain = strFromU8(unzipSync(new Uint8Array(text.bytes))['chapter-0.xhtml']!)
  expect(plain).toContain('Local illustration')
  expect(plain).not.toMatch(/<img|<style|class=|style=/)
  expect(plain.match(/data-reader-node="[^"]+"/g)).toEqual(
    chapter.match(/data-reader-node="[^"]+"/g),
  )
  formatted.dispose()
  formatted.dispose()
  text.dispose()
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:local-image')
})

it('revokes prepared resources when a later chapter is invalid or preparation is cancelled', async () => {
  const { create, revoke } = urls()
  const files = unzipSync(createFormattedEpubFixture())
  files['OPS/two.xhtml'] = new Uint8Array(strToU8('<broken>'))
  await expect(preparePublication(blob(zipSync(files, { level: 0 })))).rejects.toThrow('Malformed')
  expect(create).toHaveBeenCalledOnce()
  expect(revoke).toHaveBeenCalledOnce()
  const controller = new AbortController()
  create.mockImplementationOnce(() => {
    controller.abort()
    return 'blob:cancelled'
  })
  await expect(
    preparePublication(blob(createFormattedEpubFixture()), controller.signal),
  ).rejects.toThrow()
  expect(revoke).toHaveBeenLastCalledWith('blob:cancelled')
})

it('flattens local SVG cover wrappers without admitting live SVG or remote images', async () => {
  const { create, revoke } = urls()
  const files = unzipSync(createFormattedEpubFixture())
  const wrapper = (href: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 120 60" onload="attack()"><title>Book cover</title><image xlink:href="${href}" width="120" height="60"/></svg>`
  files['OPS/one.xhtml'] = new Uint8Array(
    strToU8(
      `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>${wrapper('images/illustration.svg')}${wrapper('https://evil.invalid/cover.png')}<p>Long chapter content remains readable.</p></body></html>`,
    ),
  )
  const file = blob(zipSync(files, { level: 0 }))
  const publication = await preparePublication(file)
  const chapter = strFromU8(unzipSync(new Uint8Array(publication.bytes))['chapter-0.xhtml']!)
  expect(chapter).toContain('src="blob:local-image"')
  expect(chapter).toContain('alt="Book cover"')
  expect(chapter).toContain('Long chapter content remains readable.')
  expect(chapter).not.toMatch(/<svg|<image|onload|attack|evil/)
  expect(create).toHaveBeenCalledOnce()
  const plainPublication = await preparePublication(file, undefined, true)
  const plain = strFromU8(unzipSync(new Uint8Array(plainPublication.bytes))['chapter-0.xhtml']!)
  expect(plain).toContain('Book cover')
  expect(plain).not.toMatch(/<img|<svg/)
  expect(plain.match(/data-reader-node="[^"]+"/g)).toEqual(
    chapter.match(/data-reader-node="[^"]+"/g),
  )
  publication.dispose()
  plainPublication.dispose()
  expect(revoke).toHaveBeenCalledOnce()
})
