// Manual local fixtures only. Does not open a browser, record timings or upload data.
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPdfFixture, createImagePdfFixture } from '../tests/fixtures/pdf.ts'
import { createFormattedEpubFixture } from '../tests/fixtures/epub.ts'

export async function createDiagnosticLibrary(parent, count) {
  if (![100, 1000].includes(count)) throw new Error('File count must be 100 or 1000')
  await mkdir(parent, { recursive: true })
  const root = await mkdtemp(path.join(parent, 'library-'))
  const library = path.join(root, 'documents')
  const smallPdf = createPdfFixture(2),
    epub = createFormattedEpubFixture()
  const special = [
    createImagePdfFixture(),
    createPdfFixture(1001),
    createFormattedEpubFixture(1000),
  ]
  let bytes = 0
  for (let i = 0; i < count; i++) {
    const isEpub = i === 2 || (i > 2 && i % 2 === 1)
    const buffer = special[i] ?? (isEpub ? epub : smallPdf)
    const directory = path.join(library, `group-${String(Math.floor(i / 50)).padStart(2, '0')}`)
    await mkdir(directory, { recursive: true })
    await writeFile(
      path.join(directory, `fixture-${String(i).padStart(4, '0')}.${isEpub ? 'epub' : 'pdf'}`),
      buffer,
      { flag: 'wx' },
    )
    bytes += buffer.length
  }
  const manifest = {
    schema: 1,
    files: count,
    bytes,
    groups: Math.ceil(count / 50),
    imagePdfPages: 12,
    textPdfPages: 1001,
    longEpubParagraphs: 1000,
  }
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {
    flag: 'wx',
  })
  return { library, manifest }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = Number(process.argv[2] ?? 100)
  if (process.argv.length > 3)
    throw new Error('Usage: node scripts/create-diagnostics-library.mjs [100|1000]')
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const result = await createDiagnosticLibrary(
    path.join(repository, 'browser-evidence', 'manual-libraries'),
    count,
  )
  console.log(`Select this documents folder with Choose folder: ${result.library}`)
  console.log(JSON.stringify(result.manifest, null, 2))
}
