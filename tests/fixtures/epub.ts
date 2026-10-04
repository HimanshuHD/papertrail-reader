import { strToU8, zipSync } from 'fflate'

function encode(text: string) {
  return new Uint8Array(strToU8(text))
}

export function createEpubFixture(
  options: { chapter?: string; packageBody?: string; fixed?: boolean; encrypted?: boolean } = {},
) {
  const files: Record<string, Uint8Array> = {
    mimetype: encode('application/epub+zip'),
    'META-INF/container.xml': encode(
      '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ),
    'OPS/book.opf': encode(
      options.packageBody ??
        `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">fixture</dc:identifier><dc:title>Local test book</dc:title><dc:language>en</dc:language>${options.fixed ? '<meta property="rendition:layout">pre-paginated</meta>' : ''}</metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>`,
    ),
    'OPS/one.xhtml': encode(
      options.chapter ??
        '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First chapter</title></head><body><h1>First chapter</h1><p>Local reading text.</p></body></html>',
    ),
    'OPS/two.xhtml': encode(
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Second chapter</title></head><body><h1>Second chapter</h1><p>The next local chapter.</p></body></html>',
    ),
  }
  if (options.encrypted) files['META-INF/encryption.xml'] = encode('<encryption/>')
  return zipSync(files, { level: 0 })
}
