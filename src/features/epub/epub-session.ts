import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import { prepareTextPublication } from './publication'
import { keepScrolledChapterMounted } from './scroll-layout'

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
  Object.assign(root.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  })
  target.append(root)
  let rendition: Rendition | null = null
  let destroyed = false
  let disposed = false
  let opening = true
  let observer: ResizeObserver | null = null
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  let width = 0
  let height = 0
  let chapterIndex = 0
  let navigating = false
  let restoreResize: (() => void) | null = null
  function applyResize() {
    if (destroyed || navigating || !rendition) return
    const nextWidth = root.clientWidth
    const nextHeight = root.clientHeight
    // Hidden panels must not replace the last usable layout with a zero-sized one.
    if (!nextWidth || !nextHeight || (nextWidth === width && nextHeight === height)) return
    width = nextWidth
    height = nextHeight
    rendition.resize(width, height)
  }
  function scheduleResize() {
    if (destroyed) return
    if (resizeTimer !== null) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      resizeTimer = null
      applyResize()
    }, 500)
  }
  function cleanup() {
    if (!destroyed || opening || disposed) return
    disposed = true
    restoreResize?.()
    restoreResize = null
    book.destroy()
    rendition = null
    root.remove()
  }
  function destroy() {
    if (destroyed) return
    destroyed = true
    observer?.disconnect()
    observer = null
    if (resizeTimer !== null) clearTimeout(resizeTimer)
    resizeTimer = null
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
      width: root.clientWidth || 1,
      height: root.clientHeight || 1,
      resizeOnOrientationChange: false,
      flow: 'scrolled-doc',
      spread: 'none',
      allowScriptedContent: false,
    })
    rendition.themes.default({
      html: { 'overflow-x': 'hidden !important' },
      body: {
        'font-family': 'Georgia, serif',
        'font-size': '18px',
        'line-height': '1.7',
        padding: '24px !important',
        'box-sizing': 'border-box !important',
        margin: '0 !important',
        'overflow-x': 'hidden !important',
      },
      '*': { 'max-width': '100%', 'overflow-wrap': 'anywhere', 'box-sizing': 'border-box' },
      pre: { 'white-space': 'pre-wrap', 'overflow-wrap': 'anywhere' },
      table: { 'table-layout': 'fixed', width: '100%' },
    })
    rendition.on('displayed', () => {
      if (!destroyed)
        root
          .querySelector('iframe')
          ?.setAttribute('title', `EPUB chapter: ${publication.chapters[chapterIndex]!.label}`)
    })
    await rendition.display(publication.chapters[0]!.href)
    signal.throwIfAborted()
    root
      .querySelector('iframe')
      ?.setAttribute('title', `EPUB chapter: ${publication.chapters[0]!.label}`)
    restoreResize = keepScrolledChapterMounted(rendition, root)
    observer = new ResizeObserver(scheduleResize)
    observer.observe(target)
    // Fit the first chapter immediately; subsequent changes wait for resize to settle.
    applyResize()
    return {
      title: publication.title,
      chapters: publication.chapters,
      async display(index) {
        signal.throwIfAborted()
        const chapter = publication.chapters[index]
        if (destroyed || !rendition || !chapter) throw new Error('EPUB session is unavailable.')
        chapterIndex = index
        navigating = true
        try {
          await rendition.display(chapter.href)
        } finally {
          navigating = false
          scheduleResize()
        }
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
