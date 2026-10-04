import { Blob } from 'node:buffer'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { expect, it } from 'vitest'
import { createContentsEpubFixture, createEpubFixture } from '../fixtures/epub'
import { preparePublication } from '../../src/features/epub/publication'
import { preflightEpubArchive } from '../../src/features/epub/archive-preflight'
import { flattenContents, parseEpubContents } from '../../src/features/epub/navigation'

const blob = (bytes: Uint8Array) => new Blob([bytes]) as unknown as globalThis.Blob
const encode = (text: string) => new Uint8Array(strToU8(text))

it.each(['nav', 'ncx'] as const)(
  'reads nested %s contents and validates retained fragments in both modes',
  async (kind) => {
    for (const textOnly of [false, true]) {
      const book = await preparePublication(
        blob(createContentsEpubFixture(kind)),
        undefined,
        textOnly,
      )
      expect(book.contentsSource).toBe(kind)
      expect(book.contents[0]!.label).toBe('Part One')
      expect(book.contents[0]!.children).toMatchObject([
        { label: 'Introduction', chapter: 0, fragment: 'intro' },
        { label: 'Later section', chapter: 0, fragment: 'section-anchor' },
      ])
      expect(book.contents[1]).toMatchObject({ chapter: 1, fragment: 'next' })
      const rebuilt = strFromU8(unzipSync(new Uint8Array(book.bytes))['chapter-0.xhtml']!)
      expect(rebuilt).toContain('id="section-anchor"')
      expect(rebuilt).not.toContain('href=')
      expect(book.fragments[0]!.has('intro')).toBe(true)
      book.dispose()
    }
  },
)

it('keeps valid children while dropping remote, traversal, missing and removed targets', async () => {
  const files = unzipSync(createContentsEpubFixture())
  files['OPS/nav/toc.xhtml'] = encode(
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:e="http://www.idpf.org/2007/ops"><body><nav e:type="landmarks toc"><ol><li><a href="https://evil.invalid/x">Remote group</a><ol><li><a href="../one.xhtml#intro">Safe child</a></li></ol></li><li><a href="../../../one.xhtml">Escape</a></li><li><a href="../one.xhtml#missing">Missing anchor</a></li><li><a href="../missing.xhtml">Missing chapter</a></li><li><a href="../one.xhtml%23intro">Encoded path</a></li><li><a href="javascript:attack()">Script</a></li><li><a href="../one.xhtml#intro%23extra">Invalid fragment</a></li></ol></nav></body></html>',
  )
  const book = await preparePublication(blob(zipSync(files, { level: 0 })))
  expect(book.contentsSource).toBe('nav')
  expect(flattenContents(book.contents).map((entry) => entry.label)).toEqual([
    'Remote group',
    'Safe child',
  ])
  expect(book.contents[0]!.chapter).toBeNull()
  expect(book.contents[0]!.children[0]).toMatchObject({ chapter: 0, fragment: 'intro' })
})

it('falls back to chapter order for absent, malformed, oversized or excessive optional navigation', async () => {
  const noNav = await preparePublication(blob(createEpubFixture()))
  expect(noNav.contentsSource).toBe('spine')
  expect(noNav.contents.map((entry) => entry.chapter)).toEqual([0, 1])
  for (const nav of [
    '<broken>',
    '<!DOCTYPE html [<!ENTITY x SYSTEM "https://evil.invalid">]><html/>',
    'x'.repeat(1024 * 1024 + 1),
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:e="http://www.idpf.org/2007/ops"><body><nav e:type="toc"><ol>' +
      '<li><a href="../one.xhtml">Chapter</a></li>'.repeat(513) +
      '</ol></nav></body></html>',
  ]) {
    const files = unzipSync(createContentsEpubFixture())
    files['OPS/nav/toc.xhtml'] = encode(nav)
    const book = await preparePublication(blob(zipSync(files, { level: 0 })))
    expect(book.contentsSource).toBe('spine')
    expect(book.contents[0]).toMatchObject({ label: 'First chapter', chapter: 0 })
  }
})

it('checks optional navigation CRC and preserves cancellation instead of swallowing it', async () => {
  const bytes = createContentsEpubFixture()
  const entry = (await preflightEpubArchive(blob(bytes))).find(
    (e) => e.path === 'OPS/nav/toc.xhtml',
  )!
  bytes[entry.dataOffset + 10] ^= 1
  const book = await preparePublication(blob(bytes))
  expect(book.contentsSource).toBe('spine')
  const controller = new AbortController()
  let cancelled = false
  const source = blob(createContentsEpubFixture())
  const navEntry = (await preflightEpubArchive(source)).find((e) => e.path === 'OPS/nav/toc.xhtml')!
  const file = {
    size: source.size,
    slice(start: number, end: number) {
      if (start === navEntry.dataOffset) {
        controller.abort()
        cancelled = true
      }
      return source.slice(start, end)
    },
  } as globalThis.Blob
  await expect(preparePublication(file, controller.signal)).rejects.toThrow()
  expect(cancelled).toBe(true)
})

it('ignores duplicate and reserved application IDs as navigation targets', async () => {
  const files = unzipSync(createContentsEpubFixture())
  files['OPS/one.xhtml'] = encode(
    '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1 id="intro">One</h1><p id="intro">Duplicate</p><p id="epubjs-inserted-css-default">Reserved</p></body></html>',
  )
  const book = await preparePublication(blob(zipSync(files, { level: 0 })))
  expect(book.fragments[0]!.has('intro')).toBe(false)
  expect(book.fragments[0]!.has('epubjs-inserted-css-default')).toBe(false)
  expect(flattenContents(book.contents).filter((entry) => entry.chapter === 0)).toHaveLength(0)
})

it('limits nested navigation independently of byte size', () => {
  const nested =
    '<li><span>Group</span><ol>'.repeat(18) +
    '<li><a href="one.xhtml">One</a></li>' +
    '</ol></li>'.repeat(18)
  const document = new DOMParser().parseFromString(
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:e="http://www.idpf.org/2007/ops"><body><nav e:type="toc"><ol>' +
      nested +
      '</ol></nav></body></html>',
    'application/xml',
  )
  expect(() => parseEpubContents(document, 'nav', () => ({ chapter: 0 }))).toThrow('nesting')
})
