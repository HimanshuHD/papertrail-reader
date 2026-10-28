import { Blob } from 'node:buffer'
import { strToU8 } from 'fflate'
import { afterEach, expect, it, vi } from 'vitest'
import { createEpubFixture } from '../fixtures/epub'
import { preparePublication } from '../../src/features/epub/publication'
import { verifyBookImage, EpubImageLimitError } from '../../src/features/epub/book-images'

afterEach(() => vi.unstubAllGlobals())
function book(count = 65, chapters = 3, invalid = 0) {
  const files: Record<string, Uint8Array> = {}
  let manifest = '',
    spine = ''
  for (let c = 0; c < chapters; c++) {
    manifest += `<item id="c${c}" href="c${c}.xhtml" media-type="application/xhtml+xml"/>`
    spine += `<itemref idref="c${c}"/>`
    let content = '<p>Readable chapter text.</p>'
    for (let i = 0; i < count; i++) {
      const path = `i${c}-${i}.svg`
      manifest += `<item id="i${c}-${i}" href="${path}" media-type="image/svg+xml"/>`
      files[`OPS/${path}`] = new Uint8Array(
        strToU8(
          i < invalid
            ? '<broken'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10"/></svg>',
        ),
      )
      content += `<img src="${path}" alt="Illustration ${i}"/>`
    }
    // Missing resources and repeated CSS/HTML references must not consume slots.
    content += '<img src="missing.svg"/><img src="i0-0.svg"/>'
    files[`OPS/c${c}.xhtml`] = new Uint8Array(
      strToU8(
        `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>p{background-image:url(i${c}-0.svg)}</style></head><body>${content}</body></html>`,
      ),
    )
  }
  return new Blob([
    createEpubFixture({
      files,
      packageBody: `<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest>${manifest}</manifest><spine>${spine}</spine></package>`,
    }),
  ]) as unknown as globalThis.Blob
}
function urls() {
  let id = 0
  const create = vi.fn(() => `blob:test-${++id}`),
    revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  return { create, revoke }
}
it('loads only active-chapter illustrations, deduplicates CSS/HTML, releases and recreates on revisit', async () => {
  const { create, revoke } = urls()
  const publication = await preparePublication(book(), undefined, false, true)
  expect(create).not.toHaveBeenCalled()
  for (const [step, index] of [0, 1, 2, 0].entries()) {
    const markup = await publication.renderChapter(index)
    expect(markup).toContain('Readable chapter text.')
    // Chapter 1/2 additionally reference the first chapter image explicitly.
    const expected = index === 0 ? 65 : 66
    const active = create.mock.calls.length - revoke.mock.calls.length
    expect(active).toBe(expected)
    expect(active).toBeLessThanOrEqual(66)
    expect(publication.imageWarnings).toEqual([])
    if (step) expect(revoke).toHaveBeenCalled()
    const calls = create.mock.calls.length
    expect(await publication.renderChapter(index)).toBe(markup)
    expect(create).toHaveBeenCalledTimes(calls)
  }
  publication.dispose()
  expect(revoke).toHaveBeenCalledTimes(create.mock.calls.length)
  await expect(publication.renderChapter(0)).rejects.toMatchObject({ name: 'AbortError' })
})
it('keeps chapter text readable at the 128/129 image boundary', async () => {
  const { create, revoke } = urls()
  const publication = await preparePublication(book(129, 1), undefined, false, true)
  const chapter = await publication.renderChapter(0)
  expect(create).toHaveBeenCalledTimes(128)
  expect(chapter).toContain('Illustration 128')
  expect(publication.imageWarnings.join(' ')).toContain('128 images')
  publication.dispose()
  expect(revoke).toHaveBeenCalledTimes(128)
})
it('preserves long drawing paths and SVG styles instead of silently stripping attributes', () => {
  const d = 'M0 0 L10 10 '.repeat(10000)
  const source = `<svg xmlns="http://www.w3.org/2000/svg"><metadata>Editor metadata</metadata><namedview xmlns="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"/><style>.art{fill:#123456;stroke:none} .bad{fill:url(https://invalid.example/x)}</style><path class="art" d="${d}"/></svg>`
  const result = new TextDecoder().decode(verifyBookImage(strToU8(source), 'image/svg+xml')!)
  expect(result).toContain(`d="${d}"`)
  expect(result).toContain('class="art"')
  expect(result).toContain('fill:#123456')
  expect(result).not.toContain('invalid.example')
})
it('rejects excessive path work and cyclic or exponential local references', () => {
  for (const content of [
    `<path d="${'M0 0 '.repeat(100001)}"/>`,
    '<defs><g id="loop"><use href="#loop"/></g></defs><use href="#loop"/>',
    '<defs>' +
      Array.from(
        { length: 20 },
        (_, i) =>
          `<g id="n${i}">${i ? `<use href="#n${i - 1}"/><use href="#n${i - 1}"/>` : '<rect/>'}</g>`,
      ).join('') +
      '</defs><use href="#n19"/>',
  ])
    expect(() =>
      verifyBookImage(
        strToU8(`<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`),
        'image/svg+xml',
      ),
    ).toThrow(EpubImageLimitError)
})

it('cannot recreate image resources after disposal interrupts a chapter read', async () => {
  const { create, revoke } = urls()
  const source = book(1, 1)
  const publication = await preparePublication(source, undefined, false, true)
  const slice = source.slice.bind(source)
  let release!: () => void
  let started!: () => void
  const ready = new Promise<void>((resolve) => {
    started = resolve
  })
  source.slice = (...args) => {
    const chunk = slice(...args),
      read = chunk.arrayBuffer.bind(chunk)
    chunk.arrayBuffer = async () => {
      started()
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return read()
    }
    return chunk
  }
  const pending = publication.renderChapter(0)
  await ready
  publication.dispose()
  release()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(create).not.toHaveBeenCalled()
  expect(revoke).not.toHaveBeenCalled()
})

it('does not consume an accepted-image slot for an invalid SVG', async () => {
  const { create } = urls()
  const publication = await preparePublication(book(129, 1, 1), undefined, false, true)
  await publication.renderChapter(0)
  expect(create).toHaveBeenCalledTimes(128)
  expect(publication.imageWarnings.join(' ')).toContain('malformed')
  expect(publication.imageWarnings.join(' ')).not.toContain('128 images')
  publication.dispose()
})

it('reports unsupported drawing elements instead of silently publishing a partial illustration', () => {
  for (const element of ['pattern', 'filter', 'script', 'foreignObject', 'image'])
    expect(() =>
      verifyBookImage(
        strToU8(`<svg xmlns="http://www.w3.org/2000/svg"><rect/><${element}/></svg>`),
        'image/svg+xml',
      ),
    ).toThrow('unsupported drawing feature')
})
