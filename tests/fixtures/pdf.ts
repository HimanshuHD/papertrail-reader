import { deflateSync } from 'node:zlib'

export function createPdfFixture(
  pageCount = 2,
  title?: string,
  searchFixture = false,
  rotation = 0,
  contentLinks = false,
): Buffer {
  const pageIds = Array.from({ length: pageCount }, (_, i) => 4 + i * 2)
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R ${contentLinks ? `/Names << /Dests << /Names [(chapter-two) [${pageIds[1] ?? pageIds[0]} 0 R /XYZ 0 720 null]] >> >>` : ''} >>`,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  for (let i = 0; i < pageCount; i++) {
    const label = i === 0 ? 'First page' : i === 1 ? 'Second page' : `Page ${i + 1}`
    const stream =
      contentLinks && i === 0
        ? 'BT /F1 18 Tf 72 720 Td (Go to second page) Tj 0 -40 Td (Open website) Tj 0 -40 Td (Missing destination) Tj 0 -40 Td (Unsafe action) Tj 0 -40 Td (Named chapter link) Tj ET'
        : searchFixture && i === 1
          ? `BT /F1 5 Tf 72 720 Td (${'A'.repeat(70)} Needle ${'B'.repeat(70)}) Tj 0 -560 Td (needle) Tj 0 -20 Td (wrapped) Tj 0 -20 Td (match <img>) Tj ET`
          : `BT /F1 24 Tf 72 720 Td (${label}) Tj ET`
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate ${rotation} /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i]! + 1} 0 R ${
        contentLinks && i === 0
          ? `/Annots [
          << /Type /Annot /Subtype /Link /Rect [72 716 245 740] /Contents (Go to second page) /Dest [${pageIds[1] ?? pageIds[0]} 0 R /XYZ 0 720 null] >>
          << /Type /Annot /Subtype /Link /Rect [72 676 190 700] /Contents (Open website) /A << /S /URI /URI (https://example.test/reader-link) >> >>
          << /Type /Annot /Subtype /Link /Rect [72 636 250 660] /Contents (Missing destination) /Dest (missing) >>
          << /Type /Annot /Subtype /Link /Rect [72 596 200 620] /Contents (Unsafe action) /A << /S /Launch /F (unsafe.exe) >> >>
          << /Type /Annot /Subtype /Link /Rect [72 556 250 580] /Contents (Named chapter link) /Dest (chapter-two) >>
        ]`
          : ''
      } >>`,
    )
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
    )
  }

  const infoId = title ? objects.push(`<< /Title (${title}) >>`) : null
  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'ascii')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${infoId ? `/Info ${infoId} 0 R` : ''} >>\n`
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'ascii')
}

/** Twelve distinct embedded raster pages, deterministic and deliberately poorly compressible. */
export function createImagePdfFixture(): Buffer {
  const pageCount = 12,
    size = 512
  const ids = Array.from({ length: pageCount }, (_, i) => 3 + i * 3)
  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from(
      `<< /Type /Pages /Kids [${ids.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    ),
  ]
  let seed = 253
  for (const id of ids) {
    const pixels = Buffer.alloc(size * size * 3)
    for (let i = 0; i < pixels.length; i++) {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      pixels[i] = 1 + ((seed >>> 0) % 252)
    }
    const image = deflateSync(pixels)
    const draw = 'q 512 0 0 512 50 140 cm /Im1 Do Q'
    objects.push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`,
      ),
      Buffer.from(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`),
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${size} /Height ${size} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.length} >>\nstream\n`,
        ),
        image,
        Buffer.from('\nendstream'),
      ]),
    )
  }
  const chunks = [Buffer.from('%PDF-1.4\n')],
    offsets = [0]
  let length = chunks[0]!.length
  objects.forEach((object, i) => {
    offsets.push(length)
    const chunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      object,
      Buffer.from('\nendobj\n'),
    ])
    chunks.push(chunk)
    length += chunk.length
  })
  chunks.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
        .join(
          '',
        )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`,
    ),
  )
  return Buffer.concat(chunks)
}
