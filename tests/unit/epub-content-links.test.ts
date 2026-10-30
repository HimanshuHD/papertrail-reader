import { Blob } from 'node:buffer'
import { strFromU8, unzipSync } from 'fflate'
import { expect, it } from 'vitest'
import { preparePublication } from '../../src/features/epub/publication'
import { createEpubFixture } from '../fixtures/epub'
for (const textOnly of [false, true])
  it(`retains inert underlined content links and resolves targets in ${textOnly ? 'text' : 'formatted'} mode`, async () => {
    const chapter =
      '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><a id="start" href="second.xhtml#target">Next</a><a href="#start">Return</a><a href="https://example.com">Website</a><a href="javascript:alert(1)">Unsupported</a></body></html>'
    const file = new Blob([
      createEpubFixture({
        chapter,
        files: {
          'OPS/second.xhtml': new Uint8Array(
            Buffer.from(
              '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><h1 id="target">Destination</h1></body></html>',
            ),
          ),
        },
        packageBody:
          '<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="second.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>',
      }),
    ])
    const pub = await preparePublication(file as unknown as globalThis.Blob, undefined, textOnly)
    try {
      const xml = strFromU8(unzipSync(new Uint8Array(pub.bytes))['chapter-0.xhtml']!)
      const doc = new DOMParser().parseFromString(xml, 'application/xml')
      expect(doc.querySelector('a')?.getAttribute('style')).toContain(
        'text-decoration:underline!important',
      )
      expect(doc.querySelector('a')?.getAttribute('tabindex')).toBe('0')
      expect(doc.querySelector('a[href]')).toBeNull()
      expect(xml).not.toContain('javascript:')
      expect(pub.resolveLink(0, 'second.xhtml#target')).toEqual({
        kind: 'epub',
        chapter: 1,
        fragment: 'target',
      })
      expect(pub.resolveLink(0, '#start')).toEqual({ kind: 'epub', chapter: 0, fragment: 'start' })
      expect(pub.resolveLink(0, 'second.xhtml#missing').kind).toBe('blocked')
    } finally {
      pub.dispose()
    }
  })
