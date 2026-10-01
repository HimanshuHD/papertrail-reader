/** Demonstration metadata only; real file discovery belongs to #8/#9. */
export interface ShellDocument {
  id: string
  title: string
  format: 'PDF' | 'EPUB'
  collection: string
  detail: string
}

/** View-only shell presentation. Library/reader workflows own their own async state later. */
export type ShellViewState = 'empty' | 'loading' | 'error' | 'demo'
