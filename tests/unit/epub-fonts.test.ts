import { Blob } from 'node:buffer'
import { strFromU8, strToU8, unzipSync } from 'fflate'
import { afterEach, expect, it, vi } from 'vitest'
import { verifyBookFont, EPUB_FONT_LIMITS } from '../../src/features/epub/book-fonts'
import { sanitizeBookCSS, stylesheetFontURLs } from '../../src/features/epub/book-styles'
import { preparePublication } from '../../src/features/epub/publication'
import { createEpubFixture } from '../fixtures/epub'
import { ttfBase64, woffBase64, woff2Base64, otfBase64 } from '../fixtures/fonts/generated-font'
const bytes = (base64 = ttfBase64) => new Uint8Array(Buffer.from(base64, 'base64'))
afterEach(() => vi.unstubAllGlobals())
for (const [data, mime] of [
  [ttfBase64, 'font/ttf'],
  [woffBase64, 'font/woff'],
  [woff2Base64, 'font/woff2'],
  [otfBase64, 'font/otf'],
])
  it(`admits the generated ${mime} container`, () => expect(verifyBookFont(bytes(data))).toBe(mime))
it('rejects truncated, overlapping and excessive font containers', () => {
  for (const data of [
    bytes().slice(0, 11),
    new Uint8Array(EPUB_FONT_LIMITS.inputBytes + 1),
    new Uint8Array(60),
  ])
    expect(() => verifyBookFont(data)).toThrow()
  const changed = bytes()
  new DataView(changed.buffer).setUint32(12 + 8, 1)
  expect(() => verifyBookFont(changed)).toThrow()
  for (const original of [woffBase64, woff2Base64]) {
    const changed = bytes(original)
    new DataView(changed.buffer).setUint32(16, EPUB_FONT_LIMITS.expandedBytes + 1)
    expect(() => verifyBookFont(changed)).toThrow()
  }
})
it('keeps font source URLs separate from generic declarations and rejects local/remote sources', () => {
  const source =
    '@font-face{font-family:"Book Font";src:url(font.ttf) format("truetype");font-weight:700;font-style:italic}p{font-family:"Book Font";background:url(font.ttf)}'
  expect(stylesheetFontURLs(source)).toEqual(['font.ttf'])
  const clean = sanitizeBookCSS(source, undefined, false, new Map([['font.ttf', 'blob:font']]))
  expect(clean).toContain('@font-face')
  expect(clean).toContain('font-weight:700')
  expect(clean).toContain('font-style:italic')
  expect(clean).toContain('font-display:block')
  expect(clean).not.toContain('background:')
  for (const src of ['local("Installed")', 'url(https://invalid.example/font.ttf)'])
    expect(
      sanitizeBookCSS(
        `@font-face{font-family:Book;src:${src}}`,
        undefined,
        false,
        new Map([['font.ttf', 'blob:font']]),
      ),
    ).not.toContain('@font-face')
  const mixed = sanitizeBookCSS(
    '@font-face{font-family:Book;src:local("Installed"),url(font.ttf) format("truetype"),url(https://invalid.example/a)}',
    undefined,
    false,
    new Map([['font.ttf', 'blob:font']]),
  )
  expect(mixed).toContain('@font-face')
  expect(mixed).not.toMatch(/local\(|invalid\.example/)
  expect(mixed).toContain('url(blob:font)')
  const state = { remaining: 1, warn: vi.fn() }
  const repeated = '@font-face{font-family:Book;src:url(font.ttf)}'.repeat(3)
  expect(
    sanitizeBookCSS(repeated, undefined, false, new Map([['font.ttf', 'blob:font']]), state).match(
      /@font-face/g,
    ),
  ).toHaveLength(1)
  expect(state.warn).toHaveBeenCalledTimes(2)
})
function book(extra = '') {
  const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Font chapter</title><style>@font-face{font-family:Book;src:url(font.ttf)}@font-face{font-family:Book;src:url(font.ttf);font-style:italic}${extra}p{font-family:Book}</style></head><body><p>Readable font text.</p></body></html>`
  return new Blob([
    createEpubFixture({
      chapter,
      manifest: '<item id="font" href="font.ttf" media-type="font/ttf"/>',
      files: { 'OPS/font.ttf': bytes() },
    }),
  ]) as unknown as globalThis.Blob
}
it('owns and deduplicates font URLs, includes them in rolling eviction and releases on close', async () => {
  let id = 0
  const create = vi.fn(() => `blob:font-${++id}`),
    revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const publication = await preparePublication(book(), undefined, false, true)
  expect(create).not.toHaveBeenCalled()
  const markup = await publication.renderChapter(0)
  expect(create).toHaveBeenCalledOnce()
  expect(markup).toContain('font-src blob:')
  expect(markup).toContain('@font-face')
  expect(publication.fontWarnings).toEqual([])
  expect(await publication.renderChapter(0)).toBe(markup)
  expect(create).toHaveBeenCalledOnce()
  publication.dispose()
  expect(revoke).toHaveBeenCalledOnce()
  await expect(publication.renderChapter(0)).rejects.toMatchObject({ name: 'AbortError' })
})
it('does not load fonts in text-only mode and reports missing sources without losing text', async () => {
  const create = vi.fn(() => 'blob:test')
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() })
  const text = await preparePublication(book(), undefined, true)
  const chapter = strFromU8(unzipSync(new Uint8Array(text.bytes))['chapter-0.xhtml']!)
  expect(chapter).toContain("font-src 'none'")
  expect(chapter).not.toContain('@font-face')
  expect(create).not.toHaveBeenCalled()
  text.dispose()
  const formatted = await preparePublication(
    book('@font-face{font-family:Missing;src:url(missing.ttf)}'),
    undefined,
    false,
    true,
  )
  expect(await formatted.renderChapter(0)).toContain('Readable font text.')
  expect(formatted.fontWarnings.length).toBeGreaterThan(0)
  formatted.dispose()
})

it('shares font URLs between retained chapters and releases only the last reference', async () => {
  const { BookFontPool } = await import('../../src/features/epub/book-fonts')
  const create = vi.fn(() => 'blob:shared-font'),
    revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const pool = new BookFontPool()
  const first = pool.add('font.ttf', bytes(), 'font/ttf')
  expect(pool.acquire('font.ttf')).toBe(first)
  expect(create).toHaveBeenCalledOnce()
  expect(pool.release(first.url)).toBe(true)
  expect(revoke).not.toHaveBeenCalled()
  expect(pool.release(first.url)).toBe(true)
  expect(revoke).toHaveBeenCalledOnce()
  expect(pool.acquire('font.ttf')).toBeUndefined()
})
it('bounds admitted font resources independently of repeated face declarations', async () => {
  const fonts: Record<string, Uint8Array> = {}
  let manifest = '',
    rules = ''
  for (let i = 0; i < 17; i++) {
    manifest += `<item id="f${i}" href="f${i}.ttf" media-type="font/ttf"/>`
    rules += `@font-face{font-family:F${i};src:url(f${i}.ttf)}`
    fonts[`OPS/f${i}.ttf`] = bytes()
  }
  let id = 0
  const create = vi.fn(() => `blob:font-${++id}`),
    revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>${rules}</style></head><body><p>Readable limits</p></body></html>`
  const file = new Blob([
    createEpubFixture({ chapter, manifest, files: fonts }),
  ]) as unknown as globalThis.Blob
  const pub = await preparePublication(file, undefined, false, true)
  expect(await pub.renderChapter(0)).toContain('Readable limits')
  expect(create).toHaveBeenCalledTimes(16)
  expect(pub.fontWarnings.length).toBeGreaterThan(0)
  pub.dispose()
  expect(revoke).toHaveBeenCalledTimes(16)
})

it('reuses one verified font across rolling chapter entries and revokes it after close', async () => {
  const files: Record<string, Uint8Array> = { 'OPS/font.ttf': bytes() }
  let manifest = '<item id="font" href="font.ttf" media-type="font/ttf"/>',
    spine = ''
  for (let i = 0; i < 4; i++) {
    manifest += `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`
    spine += `<itemref idref="c${i}"/>`
    files[`OPS/c${i}.xhtml`] = new Uint8Array(
      strToU8(
        '<html xmlns="http://www.w3.org/1999/xhtml"><head><style>@font-face{font-family:Book;src:url(font.ttf)}p{font-family:Book}</style></head><body><p>Shared font chapter</p></body></html>',
      ),
    )
  }
  const file = new Blob([
    createEpubFixture({
      files,
      packageBody: `<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest>${manifest}</manifest><spine>${spine}</spine></package>`,
    }),
  ]) as unknown as globalThis.Blob
  const create = vi.fn(() => 'blob:shared'),
    revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const pub = await preparePublication(file, undefined, false, true)
  for (let i = 0; i < 4; i++) {
    expect(await pub.renderChapter(i)).toContain('url(blob:shared)')
    pub.warmChapters(i)
    expect(create).toHaveBeenCalledOnce()
    expect(revoke).not.toHaveBeenCalled()
  }
  pub.dispose()
  expect(revoke).toHaveBeenCalledOnce()
})

it('does not recreate font URLs when disposal interrupts a pending font read', async () => {
  const source = book()
  const create = vi.fn(() => 'blob:late'),
    revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const pub = await preparePublication(source, undefined, false, true)
  const slice = source.slice.bind(source)
  let started!: () => void, release!: () => void
  const ready = new Promise<void>((resolve) => {
      started = resolve
    }),
    gate = new Promise<void>((resolve) => {
      release = resolve
    })
  source.slice = (...args) => {
    const chunk = slice(...args),
      read = chunk.arrayBuffer.bind(chunk)
    if (chunk.size === bytes().byteLength)
      chunk.arrayBuffer = async () => {
        started()
        await gate
        return read()
      }
    return chunk
  }
  const loading = pub.renderChapter(0)
  const rejected = expect(loading).rejects.toMatchObject({ name: 'AbortError' })
  await ready
  pub.dispose()
  release()
  await rejected
  expect(create).not.toHaveBeenCalled()
  expect(revoke).not.toHaveBeenCalled()
})

it('repeated linked stylesheets retain layout rules without multiplying live font faces', async () => {
  const create = vi.fn(() => 'blob:font'),
    revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const file = new Blob([
    createEpubFixture({
      chapter:
        '<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="book.css"/><link rel="stylesheet" href="book.css"/></head><body><p>Repeated styles</p></body></html>',
      manifest:
        '<item id="font" href="font.ttf" media-type="font/ttf"/><item id="css" href="book.css" media-type="text/css"/>',
      files: {
        'OPS/font.ttf': bytes(),
        'OPS/book.css': new Uint8Array(
          strToU8('@font-face{font-family:Book;src:url(font.ttf)}p{color:red;font-family:Book}'),
        ),
      },
    }),
  ]) as unknown as globalThis.Blob
  const pub = await preparePublication(file, undefined, false, true),
    markup = await pub.renderChapter(0)
  expect(markup?.match(/@font-face/g)).toHaveLength(1)
  expect(markup?.match(/color:red/g)).toHaveLength(2)
  pub.dispose()
  expect(revoke).toHaveBeenCalledOnce()
})

it('omits conditional faces to prevent late font swaps after resize, preserving media layout rules', () => {
  expect(
    stylesheetFontURLs('@media(min-width:400px){@font-face{font-family:Book;src:url(font.ttf)}}'),
  ).toEqual([])
  const state = { remaining: 16, warn: vi.fn() }
  const clean = sanitizeBookCSS(
    '@media(min-width:400px){@font-face{font-family:Book;src:url(font.ttf)}p{font-family:Book;color:red}}',
    undefined,
    false,
    new Map([['font.ttf', 'blob:font']]),
    state,
  )
  expect(clean).toContain('@media')
  expect(clean).toContain('color:red')
  expect(clean).not.toContain('@font-face')
  expect(state.warn).toHaveBeenCalledOnce()
})
