import { expect, it } from 'vitest'
import {
  prepareAnnotationExport,
  annotationExportFilename,
} from '../../src/services/annotation-export'
import type { Annotation } from '../../src/services/annotation-storage'
import type { AnnotationIdentity } from '../../src/features/annotations/selectors'

const fingerprint = 'sha256-chunks-v1:' + 'a'.repeat(64)
const text = { start: 0, end: 5, exact: 'Hello', prefix: '', suffix: ' reader' }
function record(format: 'PDF' | 'EPUB'): Annotation {
  return {
    version: 2,
    id: 'saved-1',
    color: 'pink',
    note: 'नमस्ते 🌿\n<script>plain text</script>',
    createdAt: 10,
    updatedAt: 20,
    selector:
      format === 'PDF'
        ? {
            version: 1,
            format,
            segments: [
              { page: 2, text, rectangles: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }] },
            ],
          }
        : {
            version: 1,
            format,
            chapter: 3,
            mode: 'formatted',
            cfi: 'epubcfi(/6/2!/4/2/1:0)',
            text,
          },
  }
}
for (const format of ['PDF', 'EPUB'] as const) {
  it(`exports exact ${format} committed references and strips nonportable fields without mutation`, () => {
    const annotations = [
      { ...record(format), generation: 'private', url: 'blob:private', path: '/local/private' },
    ]
    const original = structuredClone(annotations)
    const file = prepareAnnotationExport(
      {
        identity: { format, fingerprint },
        name: `Résumé.${format.toLowerCase()}`,
        title: 'A / B',
        annotations,
      },
      1000,
    )
    expect(JSON.parse(file.json)).toEqual({
      schema: 'papertrail.annotations',
      version: 1,
      exportedAt: '1970-01-01T00:00:01.000Z',
      document: { format, fingerprint, name: `Résumé.${format.toLowerCase()}`, title: 'A / B' },
      annotations: [record(format)],
    })
    expect(annotations).toEqual(original)
    expect(file.filename).toBe('papertrail-Résumé-annotations.json')
    expect(file.json).not.toContain('private')
  })
}
it('supports an empty committed collection and sanitizes bounded download names', () => {
  const file = prepareAnnotationExport(
    { identity: { format: 'PDF', fingerprint }, name: 'empty.pdf', annotations: [] },
    0,
  )
  expect(JSON.parse(file.json).annotations).toEqual([])
  expect(annotationExportFilename('../a\\b:?.pdf')).toBe('papertrail-_a_b__-annotations.json')
  expect(annotationExportFilename('.pdf')).toBe('papertrail-document-annotations.json')
  expect(annotationExportFilename('a'.repeat(500) + '.pdf').length).toBeLessThan(120)
})
it('rejects wrong identity/format, duplicate, future, malformed and oversized data as a whole', () => {
  const source = {
    identity: { format: 'PDF', fingerprint } as AnnotationIdentity,
    name: 'a.pdf',
    annotations: [record('PDF')],
  }
  for (const invalid of [
    { ...source, identity: { ...source.identity, fingerprint: 'wrong' } },
    { ...source, annotations: [record('EPUB')] },
    { ...source, annotations: [record('PDF'), record('PDF')] },
    { ...source, annotations: [{ ...record('PDF'), version: 99 }] },
    { ...source, annotations: [{ ...record('PDF'), note: 'x'.repeat(4001) }] },
    { ...source, annotations: Array(1001).fill(record('PDF')) },
    { ...source, name: '/local/a.pdf' },
    { ...source, name: 'C:\\local\\a.pdf' },
    { ...source, name: 'x\n.pdf' },
    { ...source, title: 'x'.repeat(1001) },
  ])
    expect(() => prepareAnnotationExport(invalid as typeof source)).toThrow()
  for (const now of [NaN, -1, Infinity, 8.64e15 + 1])
    expect(() => prepareAnnotationExport(source, now)).toThrow()
})
