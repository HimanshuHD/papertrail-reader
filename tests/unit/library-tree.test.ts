import { describe, expect, it } from 'vitest'
import { buildLibraryTree } from '../../src/features/library/library-tree'
import type { DiscoveredDocument, DocumentFormat } from '../../src/features/library/discovery'

function document(
  relativePath: string,
  format: DocumentFormat = relativePath.toLowerCase().endsWith('.epub') ? 'EPUB' : 'PDF',
  source: DiscoveredDocument['source'] = 'directory-picker',
): DiscoveredDocument {
  const name = relativePath.split('/').at(-1)!
  const separator = relativePath.lastIndexOf('/')
  return {
    id: `${source}:${relativePath}`,
    name,
    format,
    relativePath,
    parentPath: separator < 0 ? '' : relativePath.slice(0, separator),
    source,
    file: new File([relativePath], name),
  }
}

describe('library tree', () => {
  it('reconstructs nested relative paths with folders before files and stable counts', () => {
    const nodes = buildLibraryTree([
      document('Books/zeta.epub'),
      document('root.pdf'),
      document('Books/Alpha.pdf'),
      document('Notes/2026/βeta.pdf'),
    ])

    expect(
      nodes.map((node) => [node.kind, node.kind === 'folder' ? node.name : node.document.name]),
    ).toEqual([
      ['folder', 'Books'],
      ['folder', 'Notes'],
      ['document', 'root.pdf'],
    ])

    const books = nodes[0]
    expect(books.kind).toBe('folder')
    if (books.kind !== 'folder') return

    expect(books.documentCount).toBe(2)
    expect(
      books.children.map((node) => (node.kind === 'folder' ? node.name : node.document.name)),
    ).toEqual(['Alpha.pdf', 'zeta.epub'])

    const notes = nodes[1]
    expect(notes.kind).toBe('folder')
    if (notes.kind !== 'folder') return

    expect(notes.documentCount).toBe(1)
    expect(notes.children[0]?.kind).toBe('folder')
    if (notes.children[0]?.kind === 'folder') {
      expect(notes.children[0].name).toBe('2026')
      expect(notes.children[0].children[0]?.kind).toBe('document')
    }
  })

  it('keeps individual-file fallback flat without inventing folders', () => {
    const nodes = buildLibraryTree([
      document('same.pdf', 'PDF', 'file-input'),
      document('book.epub', 'EPUB', 'file-input'),
    ])

    expect(nodes.every((node) => node.kind === 'document')).toBe(true)
    expect(
      nodes.map((node) => (node.kind === 'document' ? node.document.name : node.name)),
    ).toEqual(['book.epub', 'same.pdf'])
  })

  it('preserves Unicode folder and document names', () => {
    const nodes = buildLibraryTree([document('पुस्तकें/यात्रा/कहानी.epub')])

    expect(nodes[0]?.kind).toBe('folder')
    if (nodes[0]?.kind !== 'folder') return
    expect(nodes[0].name).toBe('पुस्तकें')
    expect(nodes[0].children[0]?.kind).toBe('folder')
  })
})
