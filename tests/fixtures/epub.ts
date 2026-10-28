import { strToU8, zipSync } from 'fflate'

function encode(text: string) {
  return new Uint8Array(strToU8(text))
}

export function createEpubFixture(
  options: {
    version?: '2.0' | '3.0'
    toc?: string
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
        `<package xmlns="http://www.idpf.org/2007/opf" version="${options.version ?? '3.0'}" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">fixture</dc:identifier><dc:title>Local test book</dc:title><dc:language>en</dc:language>${options.fixed ? '<meta property="rendition:layout">pre-paginated</meta>' : ''}</metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/>${options.manifest ?? ''}</manifest><spine${options.toc ? ` toc="${options.toc}"` : ''}><itemref idref="one"/><itemref idref="two"/></spine></package>`,
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
export function createFormattedEpubFixture(paragraphCount = 40) {
  return createEpubFixture({
    manifest:
      '<item id="css" href="styles/book.css" media-type="text/css"/><item id="image" href="images/illustration.svg" media-type="image/svg+xml"/>',
    chapter:
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Formatted chapter</title><link rel="stylesheet" href="styles/book.css"/><style>.intro{padding:12px}</style></head><body><h1>Formatted chapter</h1><p class="intro" style="letter-spacing:1px">Author formatting.</p><img src="images/illustration.svg" alt="Local illustration"/>' +
      Array.from(
        { length: paragraphCount },
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

export function createContentsEpubFixture(kind: 'nav' | 'ncx' = 'nav') {
  const chapters =
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First chapter</title><style>body{font-size:16px;line-height:1.4}p{font-size:16px;color:#123456}</style></head><body><h1 id="intro">First chapter</h1><p>Author text.</p>' +
    Array.from(
      { length: 30 },
      (_, i) => '<p>Paragraph ' + i + '. Local reading text wraps in the reader.</p>',
    ).join('') +
    '<a id="section-anchor"/><h2>Later section</h2><p>Text after the anchor.</p></body></html>'
  const ncx =
    '<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd"><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap><navPoint><navLabel><text>Part One</text></navLabel><content src="../one.xhtml"/><navPoint><navLabel><text>Introduction</text></navLabel><content src="../one.xhtml#intro"/></navPoint><navPoint><navLabel><text>Later section</text></navLabel><content src="../one.xhtml#section-anchor"/></navPoint></navPoint><navPoint><navLabel><text>Next chapter</text></navLabel><content src="../two.xhtml#next"/></navPoint></navMap></ncx>'
  const nav =
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><span>Part One</span><ol><li><a href="../one.xhtml#intro">Introduction</a></li><li><a href="../one.xhtml#section-anchor">Later section</a></li></ol></li><li><a href="../two.xhtml#next">Next chapter</a></li></ol></nav></body></html>'
  return createEpubFixture({
    version: kind === 'ncx' ? '2.0' : '3.0',
    toc: kind === 'ncx' ? 'contents' : undefined,
    chapter: chapters,
    manifest:
      kind === 'ncx'
        ? '<item id="contents" href="nav/toc.ncx" media-type="application/x-dtbncx+xml"/>'
        : '<item id="contents" href="nav/toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    files: {
      [kind === 'ncx' ? 'OPS/nav/toc.ncx' : 'OPS/nav/toc.xhtml']: encode(
        kind === 'ncx' ? ncx : nav,
      ),
      'OPS/two.xhtml': encode(
        '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Second chapter</title></head><body><h1 id="next">Second chapter</h1><p>The next local chapter.</p></body></html>',
      ),
    },
  })
}

/** Many small chapters exercise metadata limits without oversized image/text payloads. */
export function createLargeSpineEpubFixture(count = 844, navigation = true) {
  const chapters = Array.from({ length: count }, (_, index) => ({
    id: `chapter-${index}`,
    href: `chapters/${index}.xhtml`,
    label: `Section ${index + 1}`,
  }))
  const files: Record<string, Uint8Array> = {}
  for (const chapter of chapters)
    files[`OPS/${chapter.href}`] = encode(
      `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${chapter.label}</title></head><body><h1>${chapter.label}</h1><p id="passage">Reading passage in ${chapter.label}.</p></body></html>`,
    )
  if (navigation)
    files['OPS/toc.xhtml'] = encode(
      `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol>${chapters.map((c) => `<li><a href="${c.href}#passage">${c.label}</a></li>`).join('')}</ol></nav></body></html>`,
    )
  return createEpubFixture({
    packageBody: `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">large-spine-fixture</dc:identifier><dc:title>Large spine test book</dc:title><dc:language>en</dc:language></metadata><manifest>${chapters.map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`).join('')}${navigation ? '<item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>' : ''}</manifest><spine>${chapters.map((c) => `<itemref idref="${c.id}"/>`).join('')}</spine></package>`,
    files,
  })
}

/** Detailed vector artwork with a legitimate path larger than the former 64 KiB attribute cap. */
export function createSvgFidelityEpubFixture() {
  const d = 'M10 10 L310 10 310 190 10 190 10 10 ' + '10 10 '.repeat(350000) + 'Z'
  const styles =
    '<style>.picture{display:block;width:100%;max-width:240px;margin-left:auto;margin-right:auto}h1{text-align:center;font-variant:small-caps}</style>'
  return createEpubFixture({
    manifest: '<item id="art" href="art.svg" media-type="image/svg+xml"/>',
    chapter: `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Vector chapter</title>${styles}</head><body><h1>Vector chapter</h1><img class="picture" src="art.svg" alt="Complete vector illustration"/><p>Text below the illustration.</p></body></html>`,
    files: {
      'OPS/art.svg': encode(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><style>.art{fill:#123456;stroke:none}</style><path class="art" d="${d}"/></svg>`,
      ),
      'OPS/two.xhtml': encode(
        `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Wrapper chapter</title>${styles}</head><body><h1>Wrapper chapter</h1><svg xmlns="http://www.w3.org/2000/svg" class="picture" viewBox="0 0 320 200" width="320" height="200"><title>Complete vector illustration</title><image href="art.svg" width="320" height="200"/></svg><p>Text below the wrapper.</p></body></html>`,
      ),
    },
  })
}

export function createImageHeavyEpubFixture() {
  const files: Record<string, Uint8Array> = {}
  let manifest = '',
    spine = ''
  for (let chapter = 0; chapter < 3; chapter++) {
    manifest += `<item id="c${chapter}" href="c${chapter}.xhtml" media-type="application/xhtml+xml"/>`
    spine += `<itemref idref="c${chapter}"/>`
    let content = `<h1>Illustrated section ${chapter + 1}</h1>`
    for (let image = 0; image < 65; image++) {
      const id = `image-${chapter}-${image}`
      manifest += `<item id="${id}" href="${id}.svg" media-type="image/svg+xml"/>`
      files[`OPS/${id}.svg`] = encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10"/></svg>',
      )
      content += `<img src="${id}.svg" alt="Illustration ${image + 1}"/>`
    }
    files[`OPS/c${chapter}.xhtml`] = encode(
      `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Illustrated section ${chapter + 1}</title></head><body>${content}</body></html>`,
    )
  }
  return createEpubFixture({
    files,
    packageBody: `<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest>${manifest}</manifest><spine>${spine}</spine></package>`,
  })
}
