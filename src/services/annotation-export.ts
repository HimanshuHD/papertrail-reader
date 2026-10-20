import { annotationIdentity, type AnnotationIdentity } from '../features/annotations/selectors'
import { migrateAnnotationDocument, type Annotation } from './annotation-storage'

export interface AnnotationExportSource {
  identity: AnnotationIdentity
  name: string
  title?: string
  annotations: readonly Annotation[]
}

/** A portable snapshot, deliberately independent of the IndexedDB record/generation schema. */
export interface AnnotationExport {
  schema: 'papertrail.annotations'
  version: 1
  exportedAt: string
  document: AnnotationIdentity & { name: string; title?: string }
  annotations: Annotation[]
}

function label(value: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new Error('Invalid document label.')
  // Only a display basename is portable: never carry a local path into an export.
  if (
    /[\\/]/u.test(value) ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error('Invalid document label.')
  return value
}

export function annotationExportFilename(name: string): string {
  const stem = name
    .replace(/\.[^.]+$/u, '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} ._-]/gu, '_')
    .replace(/^[ .]+|[ .]+$/gu, '')
  const bounded = Array.from(stem).slice(0, 80).join('') || 'document'
  return `papertrail-${bounded}-annotations.json`
}

/** Validate/allowlist without opening storage, writing metadata or touching the source records. */
export function prepareAnnotationExport(source: AnnotationExportSource, now = Date.now()) {
  const identity = annotationIdentity(source.identity)
  if (!identity || !Number.isSafeInteger(now) || now < 0 || now > 8.64e15)
    throw new Error('Invalid export identity or date.')
  const name = label(source.name, 255)
  // Titles are text rather than paths; bound them, but preserve punctuation and Unicode.
  const title = source.title
  if (title !== undefined && (typeof title !== 'string' || title.length > 1000))
    throw new Error('Invalid document title.')
  const validated = migrateAnnotationDocument({
    version: 2,
    id: `${identity.format}:${identity.fingerprint}`,
    ...identity,
    generation: 'export-validation',
    annotations: source.annotations,
  })
  const snapshot: AnnotationExport = {
    schema: 'papertrail.annotations',
    version: 1,
    exportedAt: new Date(now).toISOString(),
    document: { ...identity, name, ...(title ? { title } : {}) },
    annotations: validated.annotations,
  }
  return {
    json: JSON.stringify(snapshot, null, 2) + '\n',
    filename: annotationExportFilename(name),
  }
}
