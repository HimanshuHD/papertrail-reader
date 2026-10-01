/** Demonstration metadata only; real library selection/discovery/tree live under #8/#24/#25. */
export interface ShellDocument {
  id: string
  title: string
  format: 'PDF' | 'EPUB'
  collection: string
  detail: string
}

/** View-only shell presentation. Library/reader workflows own their own async state later. */
export type ShellViewState = 'empty' | 'loading' | 'error' | 'demo'
