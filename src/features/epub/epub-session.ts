import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import { prepareTextPublication } from './publication'

export interface EpubSession {
  title: string
  chapters: readonly { label: string; href: string }[]
  display(index: number): Promise<void>
  appearance(dark: boolean): void
  destroy(): void
}

/** One engine book per component; all untrusted content is removed before engine open. */
export async function openEpubSession(
  file: Blob,
  target: HTMLElement,
  signal: AbortSignal,
): Promise<EpubSession> {
  const publication = await prepareTextPublication(file, signal)
  const { default: ePub } = await import('epubjs')
  signal.throwIfAborted()
  const book: Book = ePub({
    requestMethod: () => Promise.reject(new Error('External EPUB requests are disabled.')),
  })
  const root = document.createElement('div')
  Object.assign(root.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
  target.append(root)
  let rendition: Rendition | null = null
  let destroyed = false
  let disposed = false
  let opening = true
  function cleanup() {
    if (!destroyed || opening || disposed) return
    disposed = true
    book.destroy()
    rendition = null
    root.remove()
  }
  function destroy() {
    if (destroyed) return
    destroyed = true
    signal.removeEventListener('abort', destroy)
    root.style.visibility = 'hidden'
    cleanup()
  }
  signal.addEventListener('abort', destroy, { once: true })
  try {
    await book.open(publication.bytes, 'binary')
    opening = false
    cleanup()
    signal.throwIfAborted()
    rendition = book.renderTo(root, {
      width: '100%',
      height: '100%',
      flow: 'scrolled-doc',
      spread: 'none',
      allowScriptedContent: false,
    })
    rendition.themes.default({
      body: {
        'font-family': 'Georgia, serif',
        'font-size': '18px',
        'line-height': '1.7',
        padding: '24px !important',
      },
      '*': { 'max-width': '100%', 'overflow-wrap': 'anywhere' },
      table: { 'table-layout': 'fixed', width: '100%' },
    })
    await rendition.display(publication.chapters[0]!.href)
    signal.throwIfAborted()
    root
      .querySelector('iframe')
      ?.setAttribute('title', `EPUB chapter: ${publication.chapters[0]!.label}`)
    return {
      title: publication.title,
      chapters: publication.chapters,
      async display(index) {
        signal.throwIfAborted()
        const chapter = publication.chapters[index]
        if (destroyed || !rendition || !chapter) throw new Error('EPUB session is unavailable.')
        await rendition.display(chapter.href)
        signal.throwIfAborted()
        root.querySelector('iframe')?.setAttribute('title', `EPUB chapter: ${chapter.label}`)
      },
      appearance(dark) {
        if (!rendition || destroyed) return
        rendition.themes.override('color', dark ? '#e7e9ee' : '#202636', true)
        rendition.themes.override('background-color', dark ? '#151b27' : '#ffffff', true)
      },
      destroy,
    }
  } catch (error) {
    destroy()
    throw error
  } finally {
    opening = false
    cleanup()
  }
}
