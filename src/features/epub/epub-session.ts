import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import type Contents from 'epubjs/types/contents'
import type { EpubContentsEntry } from './navigation'
import { normalizeTypography, typographyCSS, type EpubTypography } from './typography'
import { preparePublication } from './publication'
import {
  captureLocation,
  restoreLocation,
  normalizeLocation,
  type EpubLocation,
  type CfiBridge,
} from './location'
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
  typography?: EpubTypography
  location?: EpubLocation
}
export interface EpubSession {
  title: string
  chapters: readonly { label: string; href: string }[]
  contents: readonly EpubContentsEntry[]
  contentsSource: 'nav' | 'ncx' | 'spine'
  display(index: number, fragment?: string): Promise<void>
  typography(settings: EpubTypography): void
  defaultFontSize?(): number
  location?(): EpubLocation | undefined
  restore?(location: EpubLocation): Promise<boolean>
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
  const requestedLocation = normalizeLocation(options.location, publication.chapters.length)
  let chapterIndex = Math.max(
    0,
    Math.min(requestedLocation?.chapter ?? options.chapter ?? 0, publication.chapters.length - 1),
  )
  let navigating = false
  let navigationEpoch = 0
  let restorationEpoch = 0
  let restorationFrame = 0
  let restoring = false
  let lastLocation: EpubLocation | undefined
  const mode = options.textOnly ? 'text' : 'formatted'
  let scrollContainer: HTMLElement | null = null
  const inputDocuments = new Set<Document>()
  function bridge(): CfiBridge | undefined {
    const doc = root.querySelector('iframe')?.contentDocument
    const contents = rendition?.getContents() as unknown as Contents[] | undefined
    return contents?.find((content) => content.document === doc)
  }
  function currentLocation() {
    return destroyed || navigating ? undefined : captureLocation(root, chapterIndex, mode, bridge())
  }
  function cancelRestoration() {
    ++restorationEpoch
    cancelAnimationFrame(restorationFrame)
    restorationFrame = 0
    restoring = false
  }
  function keepLocation(saved: EpubLocation | undefined) {
    cancelRestoration()
    if (!saved || destroyed || navigating || saved.chapter !== chapterIndex) return false
    const owner = restorationEpoch
    restoring = true
    const applied = restoreLocation(root, saved, mode, bridge())
    if (applied) lastLocation = saved
    let frames = 0
    function settle() {
      if (destroyed || navigating || owner !== restorationEpoch) return
      if (applied) restoreLocation(root, saved!, mode, bridge())
      if (++frames < 2) restorationFrame = requestAnimationFrame(settle)
      else {
        restoring = false
        restorationFrame = 0
        // Reflow can put an earlier character on the same visible line.
        // Keep the original logical point until user scrolling replaces it.
        lastLocation = applied ? saved : currentLocation()
      }
    }
    restorationFrame = requestAnimationFrame(settle)
    return applied
  }
  function rememberScroll() {
    if (!restoring && !navigating) lastLocation = currentLocation()
  }
  function userInput() {
    cancelRestoration()
  }
  function bindLocationEvents() {
    if (!scrollContainer) {
      scrollContainer = root.querySelector<HTMLElement>('.epub-container')
      scrollContainer?.addEventListener('scroll', rememberScroll, { passive: true })
      scrollContainer?.addEventListener('wheel', userInput, { passive: true })
      scrollContainer?.addEventListener('pointerdown', userInput, true)
    }
    for (const doc of inputDocuments) {
      doc.removeEventListener('pointerdown', userInput, true)
      doc.removeEventListener('keydown', userInput, true)
    }
    inputDocuments.clear()
    const doc = root.querySelector('iframe')?.contentDocument
    if (doc) {
      doc.addEventListener('pointerdown', userInput, true)
      doc.addEventListener('keydown', userInput, true)
      inputDocuments.add(doc)
    }
    if (!restoring) lastLocation = currentLocation()
  }
  let restoreResize: (() => void) | null = null
  function restorePosition(saved: EpubPosition | undefined) {
    if (saved) {
      const container = root.querySelector<HTMLElement>('.epub-container')
      const iframe = root.querySelector('iframe')
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
  }
  function capturePosition(): EpubPosition | undefined {
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
  }
  function applyResize() {
    if (destroyed || navigating || !rendition) return
    const nextWidth = root.clientWidth
    const nextHeight = root.clientHeight
    // Hidden panels must not replace the last usable layout with a zero-sized one.
    if (!nextWidth || !nextHeight || (nextWidth === width && nextHeight === height)) return
    const saved = lastLocation ?? currentLocation()
    width = nextWidth
    height = nextHeight
    rendition.resize(width, height)
    if (saved) keepLocation(saved)
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
    ++navigationEpoch
    cancelRestoration()
    scrollContainer?.removeEventListener('scroll', rememberScroll)
    scrollContainer?.removeEventListener('wheel', userInput)
    scrollContainer?.removeEventListener('pointerdown', userInput, true)
    for (const doc of inputDocuments) {
      doc.removeEventListener('pointerdown', userInput, true)
      doc.removeEventListener('keydown', userInput, true)
    }
    inputDocuments.clear()
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
    rendition.themes.registerCss(
      'papertrail-typography',
      typographyCSS(normalizeTypography(options.typography ?? {})),
    )
    const defaultSizes = new WeakMap<Document, number>()
    rendition.hooks.content.register((contents: Contents) => {
      const doc = contents.document
      const sample = doc.querySelector('p,li') ?? doc.body
      const size =
        sample && doc.defaultView
          ? parseFloat(doc.defaultView.getComputedStyle(sample).fontSize)
          : NaN
      defaultSizes.set(doc, Number.isFinite(size) && size > 0 ? Math.round(size * 10) / 10 : 18)
      rendition?.themes.add('papertrail-typography', contents)
    })
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
    restoreResize = keepScrolledChapterMounted(rendition, root, {
      capture: () => lastLocation ?? currentLocation(),
      restore: (saved) => {
        if (saved) keepLocation(saved as EpubLocation)
      },
    })
    observer = new ResizeObserver(scheduleResize)
    observer.observe(target)
    // Fit the first chapter immediately; subsequent changes wait for resize to settle.
    applyResize()
    if (requestedLocation) keepLocation(requestedLocation)
    else restorePosition(options.position)
    bindLocationEvents()
    const session: EpubSession = {
      title: publication.title,
      chapters: publication.chapters,
      contents: publication.contents,
      contentsSource: publication.contentsSource,
      async display(index, fragment) {
        signal.throwIfAborted()
        const chapter = publication.chapters[index]
        if (destroyed || !rendition || !chapter) throw new Error('EPUB session is unavailable.')
        if (fragment && !publication.fragments[index]?.has(fragment))
          throw new Error('EPUB contents target is unavailable.')
        const owner = ++navigationEpoch
        cancelRestoration()
        lastLocation = undefined
        const previousChapter = chapterIndex
        const sameChapter = chapterIndex === index
        chapterIndex = index
        navigating = true
        try {
          if (!sameChapter) await rendition.display(chapter.href)
          signal.throwIfAborted()
          if (owner !== navigationEpoch) throw new Error('EPUB navigation was replaced.')
          if (destroyed) throw new Error('EPUB session is unavailable.')
          const container = root.querySelector<HTMLElement>('.epub-container')
          const iframe = root.querySelector('iframe')
          if (container && iframe) {
            const anchor = fragment ? iframe.contentDocument?.getElementById(fragment) : null
            if (anchor)
              container.scrollTop +=
                iframe.getBoundingClientRect().top +
                anchor.getBoundingClientRect().top -
                container.getBoundingClientRect().top
            else container.scrollTop = 0
          }
        } catch (error) {
          if (owner === navigationEpoch) chapterIndex = previousChapter
          throw error
        } finally {
          if (owner === navigationEpoch) {
            navigating = false
            bindLocationEvents()
            scheduleResize()
          }
        }
        signal.throwIfAborted()
        root.querySelector('iframe')?.setAttribute('title', `EPUB chapter: ${chapter.label}`)
      },
      typography(settings) {
        if (destroyed || !rendition || navigating) return
        const savedLocation = lastLocation ?? currentLocation()
        const saved = capturePosition()
        rendition.themes.registerCss('papertrail-typography', typographyCSS(settings))
        // epub.js 0.3.93 returns an array; its declaration incorrectly says one Contents.
        const contents = rendition.getContents() as unknown as Contents[]
        contents.forEach((content) => rendition?.themes.add('papertrail-typography', content))
        // Recalculate the existing view even when the viewport dimensions are unchanged.
        if (root.clientWidth && root.clientHeight)
          rendition.resize(root.clientWidth, root.clientHeight)
        if (savedLocation) keepLocation(savedLocation)
        else restorePosition(saved)
      },
      defaultFontSize() {
        const doc = root.querySelector('iframe')?.contentDocument
        return doc ? (defaultSizes.get(doc) ?? 18) : 18
      },
      location: () => lastLocation ?? currentLocation(),
      async restore(value) {
        const saved = normalizeLocation(value, publication.chapters.length)
        if (!saved || destroyed || navigating) return false
        const expected = navigationEpoch + (saved.chapter !== chapterIndex ? 1 : 0)
        try {
          if (saved.chapter !== chapterIndex) await session.display(saved.chapter)
        } catch {
          return false
        }
        if (destroyed || navigationEpoch !== expected) return false
        const result = keepLocation(saved)
        if (result) lastLocation = saved
        return result
      },
      position: capturePosition,
      appearance(dark) {
        if (!rendition || destroyed) return
        applyTheme(dark)
      },
      destroy,
    }
    return session
  } catch (error) {
    destroy()
    throw error
  } finally {
    opening = false
    cleanup()
  }
}
