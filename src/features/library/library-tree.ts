import type { LibraryDocumentMetadata } from './discovery'

export interface LibraryFolderNode {
  kind: 'folder'
  id: string
  name: string
  path: string
  documentCount: number
  children: readonly LibraryTreeNode[]
}

export interface LibraryDocumentNode {
  kind: 'document'
  id: string
  document: LibraryDocumentMetadata
}

export type LibraryTreeNode = LibraryFolderNode | LibraryDocumentNode

interface MutableFolder {
  name: string
  path: string
  folders: Map<string, MutableFolder>
  documents: LibraryDocumentMetadata[]
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    sensitivity: 'base',
    numeric: true,
  })
}

function countDocuments(folder: MutableFolder): number {
  let count = folder.documents.length
  for (const child of folder.folders.values()) count += countDocuments(child)
  return count
}

function toNodes(folder: MutableFolder): readonly LibraryTreeNode[] {
  const folders = [...folder.folders.values()]
    .sort((left, right) => compareText(left.name, right.name))
    .map<LibraryFolderNode>((child) => ({
      kind: 'folder',
      id: `folder:${child.path}`,
      name: child.name,
      path: child.path,
      documentCount: countDocuments(child),
      children: toNodes(child),
    }))

  const documents = [...folder.documents]
    .sort(
      (left, right) =>
        compareText(left.name, right.name) || compareText(left.relativePath, right.relativePath),
    )
    .map<LibraryDocumentNode>((document) => ({
      kind: 'document',
      id: `document:${document.id}`,
      document,
    }))

  return [...folders, ...documents]
}

export function buildLibraryTree(
  documents: readonly LibraryDocumentMetadata[],
): readonly LibraryTreeNode[] {
  const root: MutableFolder = {
    name: '',
    path: '',
    folders: new Map(),
    documents: [],
  }

  for (const document of documents) {
    const parts = document.parentPath.split('/').filter(Boolean)
    let parent = root
    let path = ''

    for (const name of parts) {
      path = path ? `${path}/${name}` : name
      let folder = parent.folders.get(name)

      if (!folder) {
        folder = {
          name,
          path,
          folders: new Map(),
          documents: [],
        }
        parent.folders.set(name, folder)
      }

      parent = folder
    }

    parent.documents.push(document)
  }

  return toNodes(root)
}
