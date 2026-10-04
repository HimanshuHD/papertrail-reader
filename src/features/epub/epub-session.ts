import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import { preparePublication } from './publication'
import { keepScrolledChapterMounted } from './scroll-layout'

export interface EpubPosition {
  node: string
  offset: number
  ratio: number
}
export interface EpubOpenOptions {
  textOnly?: boolean
  chapter?: number
  position?: EpubPosition
}
export interface EpubSession {
  title: string
  chapters: readonly { label: string; href: string }[]
  display(index: number): Promise<void>
  position?(): EpubPosition | undefined
  appearance(dark: boolean): void
  destroy(): void
}

/** One engine book per component; active content is removed before engine open. */
export async function openEpubSession(
  file: Blob,
  target: HTMLElement,
  signal: AbortSignal,
  options: EpubOpenOptions = {},
): Promise<EpubSession> {
  const publication = await preparePublication(file, signal, options.textOnly ?? false)
  let engine: typeof import('epubjs')
  try {
    engine = await import('epubjs')
    signal.throwIfAborted()
  } catch (error) {
    publication.dispose()
    throw error
  }
  const { default: ePub } = engine
  let book: Book
  try {
    book = ePub({
      requestMethod: () => Promise.reject(new Error('External EPUB requests are disabled.')),
    })
  } catch (error) {
    publication.dispose()
    throw error
  }
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
  let chapterIndex = Math.max(0, Math.min(options.chapter ?? 0, publication.chapters.length - 1))
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
    }, 150)
  }
  function cleanup() {
    if (!destroyed || opening || disposed) return
    disposed = true
    restoreResize?.()
    restoreResize = null
    try {
      book.destroy()
    } finally {
      publication.dispose()
      rendition = null
      root.remove()
    }
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
    function applyTheme(dark: boolean) {
      rendition?.themes.default({
        html: { 'overflow-x': 'hidden !important' },
        ':where(body)': {
          'font-family': 'Georgia, serif',
          'font-size': '18px',
          'line-height': '1.7',
          color: dark ? '#e7e9ee' : '#202636',
          'background-color': dark ? '#151b27' : '#ffffff',
          margin: '0',
          padding: '24px',
        },
        body: { 'box-sizing': 'border-box !important', 'overflow-x': 'hidden !important' },
        '*': {
          'max-width': '100% !important',
          'min-width': '0 !important',
          'overflow-wrap': 'anywhere',
          'box-sizing': 'border-box',
        },
        pre: { 'white-space': 'pre-wrap', 'overflow-wrap': 'anywhere' },
        table: { 'table-layout': 'fixed', 'max-width': '100%' },
        img: { 'max-width': '100% !important', height: 'auto' },
      })
      if (options.textOnly) {
        rendition?.themes.override('color', dark ? '#e7e9ee' : '#202636', true)
        rendition?.themes.override('background-color', dark ? '#151b27' : '#ffffff', true)
      }
    }
    applyTheme(false)
    rendition.on('displayed', () => {
      if (!destroyed)
        root
          .querySelector('iframe')
          ?.setAttribute('title', `EPUB chapter: ${publication.chapters[chapterIndex]!.label}`)
    })
    await rendition.display(publication.chapters[chapterIndex]!.href)
    signal.throwIfAborted()
    root
      .querySelector('iframe')
      ?.setAttribute('title', `EPUB chapter: ${publication.chapters[chapterIndex]!.label}`)
    restoreResize = keepScrolledChapterMounted(rendition, root)
    observer = new ResizeObserver(scheduleResize)
    observer.observe(target)
    // Fit the first chapter immediately; subsequent changes wait for resize to settle.
    applyResize()
    if (options.position) {
      const container = root.querySelector<HTMLElement>('.epub-container')
      const iframe = root.querySelector('iframe')
      const saved = options.position
      const element = /^pt-\d+$/u.test(saved.node)
        ? iframe?.contentDocument?.querySelector(`[data-reader-node="${saved.node}"]`)
        : null
      if (container && iframe) {
        if (element)
          container.scrollTop +=
            iframe.getBoundingClientRect().top +
            element.getBoundingClientRect().top -
            container.getBoundingClientRect().top -
            saved.offset
        else
          container.scrollTop =
            saved.ratio * Math.max(0, container.scrollHeight - container.clientHeight)
      }
    }
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
      position() {
        const container = root.querySelector<HTMLElement>('.epub-container')
        const iframe = root.querySelector('iframe')
        if (!container || !iframe?.contentDocument) return undefined
        const viewport = container.getBoundingClientRect()
        const frameTop = iframe.getBoundingClientRect().top
        const elements = [...iframe.contentDocument.querySelectorAll('[data-reader-node]')]
        const element = elements.find((el) => {
          const rect = el.getBoundingClientRect()
          return (
            rect.bottom + frameTop > viewport.top &&
            rect.top + frameTop < viewport.bottom &&
            ['p', 'h1', 'h2', 'h3', 'li', 'pre', 'td', 'figure'].includes(el.localName)
          )
        })
        return {
          node: element?.getAttribute('data-reader-node') ?? '',
          offset: element ? element.getBoundingClientRect().top + frameTop - viewport.top : 0,
          ratio: container.scrollTop / Math.max(1, container.scrollHeight - container.clientHeight),
        }
      },
      appearance(dark) {
        if (!rendition || destroyed) return
        applyTheme(dark)
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
