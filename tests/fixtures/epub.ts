import { strToU8, zipSync } from 'fflate'

function encode(text: string) {
  return new Uint8Array(strToU8(text))
}

export function createEpubFixture(
  options: {
    chapter?: string
    packageBody?: string
    fixed?: boolean
    encrypted?: boolean
    manifest?: string
    files?: Record<string, Uint8Array>
  } = {},
) {
  const files: Record<string, Uint8Array> = {
    mimetype: encode('application/epub+zip'),
    'META-INF/container.xml': encode(
      '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ),
    'OPS/book.opf': encode(
      options.packageBody ??
        `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">fixture</dc:identifier><dc:title>Local test book</dc:title><dc:language>en</dc:language>${options.fixed ? '<meta property="rendition:layout">pre-paginated</meta>' : ''}</metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/>${options.manifest ?? ''}</manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>`,
    ),
    'OPS/one.xhtml': encode(
      options.chapter ??
        '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First chapter</title></head><body><h1>First chapter</h1><p>Local reading text.</p></body></html>',
    ),
    'OPS/two.xhtml': encode(
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Second chapter</title></head><body><h1>Second chapter</h1><p>The next local chapter.</p></body></html>',
    ),
  }
  Object.assign(files, options.files)
  if (options.encrypted) files['META-INF/encryption.xml'] = encode('<encryption/>')
  return zipSync(files, { level: 0 })
}

/** Local author styling and a self-contained vector illustration, without network dependencies. */
export function createFormattedEpubFixture() {
  return createEpubFixture({
    manifest:
      '<item id="css" href="styles/book.css" media-type="text/css"/><item id="image" href="images/illustration.svg" media-type="image/svg+xml"/>',
    chapter:
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Formatted chapter</title><link rel="stylesheet" href="styles/book.css"/><style>.intro{padding:12px}</style></head><body><h1>Formatted chapter</h1><p class="intro" style="letter-spacing:1px">Author formatting.</p><img src="images/illustration.svg" alt="Local illustration"/>' +
      Array.from(
        { length: 40 },
        (_, i) => '<p>Reading paragraph ' + i + '. Local text flows across the reader.</p>',
      ).join('') +
      '</body></html>',
    files: {
      'OPS/styles/book.css': encode(
        'body{color:#123456;background-color:#fff8ec;font-family:serif}.intro{text-align:center;margin:20px 0}.intro + img{width:120px}',
      ),
      'OPS/images/illustration.svg': encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><rect width="120" height="60" fill="#568bc0"/><circle cx="60" cy="30" r="20" fill="#ffcf60"/></svg>',
      ),
    },
  })
}
