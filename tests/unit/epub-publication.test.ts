import { Blob } from 'node:buffer'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { expect, it } from 'vitest'
import { createEpubFixture } from '../fixtures/epub'
import { preflightEpubArchive } from '../../src/features/epub/archive-preflight'
import { prepareTextPublication, readEpubEntry } from '../../src/features/epub/publication'

const blob = (bytes: Uint8Array) => new Blob([bytes]) as unknown as globalThis.Blob

it('removes standard XHTML doctypes while retaining EPUB 2 text and direction', async () => {
  const original = unzipSync(createEpubFixture())
  const book = await prepareTextPublication(
    blob(
      createEpubFixture({
        packageBody: strFromU8(original['OPS/book.opf']!).replace('version="3.0"', 'version="2.0"'),
        chapter:
          '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html xmlns="http://www.w3.org/1999/xhtml" dir="rtl"><head><title>Book</title></head><body><p>Chapter text.</p></body></html>',
      }),
    ),
  )
  const text = strFromU8(unzipSync(new Uint8Array(book.bytes))['chapter-0.xhtml']!)
  expect(text).toContain('dir="rtl"')
  expect(text).not.toContain('DOCTYPE')
})

it('verifies and rebuilds publication text without author scripts, URLs or CSS', async () => {
  const hostile =
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First chapter</title><base href="https://evil.invalid/"/><link rel="stylesheet" href="https://evil.invalid/x.css"/></head><body onload="alert(1)"><h1 style="background:url(https://evil.invalid/image)">Safe text</h1><script>alert(1)</script><iframe src="https://evil.invalid/frame"/><img src="https://evil.invalid/image" alt="Illustration"/><a href="javascript:alert(1)">Link text</a><svg xmlns="http://www.w3.org/2000/svg"><script>alert(2)</script></svg><p>Last paragraph.</p></body></html>'
  const book = await prepareTextPublication(blob(createEpubFixture({ chapter: hostile })))
  expect(book.title).toBe('Local test book')
  expect(book.chapters).toHaveLength(2)
  const resources = unzipSync(new Uint8Array(book.bytes))
  const chapter = strFromU8(resources['chapter-0.xhtml']!)
  expect(chapter).toContain('Safe text')
  expect(chapter).toContain('Illustration')
  expect(chapter).toContain('Link text')
  expect(chapter).toContain("default-src 'none'")
  expect(chapter).not.toMatch(/evil|alert|onload|<script|<iframe|<svg|<img|href=/)
  expect(Object.keys(resources)).toEqual([
    'mimetype',
    'chapter-0.xhtml',
    'chapter-1.xhtml',
    'META-INF/container.xml',
    'package.opf',
  ])
})

it('rejects fixed layout, encrypted publications and malformed XML before engine import', async () => {
  for (const options of [
    { fixed: true },
    { encrypted: true },
    { packageBody: '<package>' },
    { chapter: '<!DOCTYPE html [<!ENTITY x SYSTEM "https://evil.invalid/">]><html/>' },
  ]) {
    await expect(prepareTextPublication(blob(createEpubFixture(options)))).rejects.toThrow()
  }
})

it('rejects remote, missing and non-XHTML spine resources', async () => {
  const original = unzipSync(createEpubFixture())
  const opf = strFromU8(original['OPS/book.opf']!)
  for (const replacement of [
    opf.replace('one.xhtml', 'https://evil.invalid/book'),
    opf.replace('one.xhtml', 'missing.xhtml'),
    opf.replace('application/xhtml+xml', 'image/svg+xml'),
  ]) {
    await expect(
      prepareTextPublication(blob(createEpubFixture({ packageBody: replacement }))),
    ).rejects.toThrow()
  }
})

it('checks actual deflate output and CRC independently of declared metadata', async () => {
  const original = unzipSync(createEpubFixture())
  original['OPS/one.xhtml'] = new Uint8Array(
    strToU8(
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>' +
        Array.from({ length: 1000 }, (_, i) => `word${i} `).join('') +
        '</p></body></html>',
    ),
  )
  const file = blob(
    zipSync({ ...original, mimetype: [original.mimetype!, { level: 0 }] }, { level: 6 }),
  )
  const entry = (await preflightEpubArchive(file)).find((item) => item.path === 'OPS/one.xhtml')!
  expect(entry.method).toBe(8)
  expect(await readEpubEntry(file, entry)).toEqual(original['OPS/one.xhtml'])
  await expect(readEpubEntry(file, { ...entry, expandedBytes: 1 })).rejects.toThrow('budget')
  await expect(readEpubEntry(file, { ...entry, crc: entry.crc ^ 1 })).rejects.toThrow('checksum')
})

it('aborts publication preparation without returning a reusable buffer', async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(
    prepareTextPublication(blob(createEpubFixture()), controller.signal),
  ).rejects.toThrow()
})
