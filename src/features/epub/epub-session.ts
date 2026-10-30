import type { DocumentLink } from '../reader/document-links'
import { settleBookFonts } from './font-readiness'
import { applyBookViewport } from './book-viewport'
import { diagnostics, diagnosticOutcome } from '../diagnostics/recorder'
import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import type Contents from 'epubjs/types/contents'
import type Section from 'epubjs/types/section'
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
import { managedEpubViewManager, type EpubManagerConstructor } from './view-manager'
import { scrollHighlightRange } from '../annotations/highlight-navigation'

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
export interface EpubAnnotationContext {
  document: Document
  chapter: number
  mode: 'formatted' | 'text'
  cfiFromRange?: (range: Range) => string
}
export interface EpubSession {
  imageWarnings?: readonly string[]
  fontWarnings?: readonly string[]
  title: string
  chapters: readonly { label: string; href: string }[]
  contents: readonly EpubContentsEntry[]
  contentsSource: 'nav' | 'ncx' | 'spine'
  display(index: number, fragment?: string): Promise<void>
  typography(settings: EpubTypography): void
  annotationContext?(): EpubAnnotationContext | undefined
  revealRange?(range: Range): boolean
  defaultFontSize?(): number
  location?(): EpubLocation | undefined
  restore?(location: EpubLocation): Promise<boolean>
  position?(): EpubPosition | undefined
  resolveLink?(chapter: number, href: string): DocumentLink
  appearance(dark: boolean): void
  destroy(): void
}

/** One engine book per component; active content is removed before engine open. */
async function createEpubSession(
  file: Blob,
  target: HTMLElement,
  signal: AbortSignal,
  options: EpubOpenOptions = {},
): Promise<EpubSession> {
  const publication = await preparePublication(file, signal, options.textOnly ?? false, true)
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
  if (__READER_DIAGNOSTICS__) diagnostics.resources(root, { viewers: 1 })
  let rendition: Rendition | null = null
  let destroyed = false
  let disposed = false
  let opening = true
  const pendingDisplays = new Set<() => void>()
  const fontLayoutWarnings = new WeakMap<Document, string | null>()
  async function displayChapter(href: string): Promise<void> {
    const current = rendition
    if (!current || destroyed) return Promise.reject(new Error('EPUB session is unavailable.'))
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const pending = current as Rendition & { displaying?: { reject(reason: unknown): void } }
      function finish(error?: unknown) {
        if (settled) return
        settled = true
        current!.off?.('displayerror', failed)
        signal.removeEventListener('abort', cancel)
        pendingDisplays.delete(cancel)
        if (error) reject(error)
        else resolve()
      }
      function failed(error: unknown) {
        // epub.js 0.3.93 emits displayError without rejecting its display defer.
        // Settle that defer as well so its queue cannot stay blocked forever.
        pending.displaying?.reject(error)
        pending.displaying = undefined
        finish(error)
      }
      function cancel() {
        failed(new DOMException('EPUB display was cancelled.', 'AbortError'))
      }
      current.on('displayerror', failed)
      pendingDisplays.add(cancel)
      signal.addEventListener('abort', cancel, { once: true })
      if (signal.aborted || destroyed) cancel()
      else {
        try {
          Promise.resolve(current.display(href)).then(() => finish(), finish)
        } catch (error) {
          failed(error)
        }
      }
    })
    const doc = root.querySelector('iframe')?.contentDocument
    if (doc && !options.textOnly) {
      fontLayoutWarnings.set(doc, await settleBookFonts(doc, signal))
      signal.throwIfAborted()
      // Reframe the mounted chapter after font metrics settle, without clearing it.
      const manager = (
        current as unknown as {
          manager?: { views?: { forEach(callback: (view: { expand?(): void }) => void): void } }
        }
      ).manager
      manager?.views?.forEach((view) => view.expand?.())
    }
  }
  let observer: ResizeObserver | null = null
  let diagnosticFrame = 0
  let finishReflow: ReturnType<typeof diagnostics.start>
  let unregisterReflow: (() => void) | undefined
  function cancelReflow() {
    cancelAnimationFrame(diagnosticFrame)
    diagnosticFrame = 0
    unregisterReflow?.()
    unregisterReflow = undefined
    finishReflow?.('cancelled')
    finishReflow = undefined
  }
  function measureReflow() {
    cancelReflow()
    finishReflow = diagnostics.start('epub.reflow')
    if (!finishReflow) return
    unregisterReflow = diagnostics.onStop(cancelReflow)
    return () => {
      diagnosticFrame = requestAnimationFrame(() => {
        diagnosticFrame = requestAnimationFrame(() => {
          finishReflow?.()
          finishReflow = undefined
          unregisterReflow?.()
          unregisterReflow = undefined
          diagnosticFrame = 0
        })
      })
    }
  }
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
    root.style.setProperty('--papertrail-viewport-height', `${height}px`)
    const settled = __READER_DIAGNOSTICS__ ? measureReflow() : undefined
    try {
      for (const frame of root.querySelectorAll('iframe')) {
        if (frame.contentDocument) applyBookViewport(frame.contentDocument, width, height)
      }
      rendition.resize(width, height)
      settled?.()
    } catch (error) {
      if (__READER_DIAGNOSTICS__) {
        finishReflow?.(diagnosticOutcome(error))
        cancelReflow()
      }
      throw error
    }
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
    for (const cancel of [...pendingDisplays]) cancel()
    if (__READER_DIAGNOSTICS__) {
      cancelReflow()
    }
    if (__READER_DIAGNOSTICS__) diagnostics.release(root)
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
    book.spine?.hooks.serialize.register(async (_markup: string, section: Section) => {
      const markup = await publication.renderChapter(section.index)
      if (markup !== undefined) section.output = markup
    })
    opening = false
    cleanup()
    signal.throwIfAborted()
    root.style.setProperty('--papertrail-viewport-height', `${root.clientHeight || 1}px`)
    rendition = book.renderTo(root, {
      manager: managedEpubViewManager(
        engine.Rendition.prototype.requireManager('default') as EpubManagerConstructor,
      ),
      width: root.clientWidth || 1,
      height: root.clientHeight || 1,
      resizeOnOrientationChange: false,
      flow: 'scrolled-doc',
      spread: 'none',
      allowScriptedContent: false,
    })
    // epub.js's paginated-image adjustment also runs in scrolled-doc and injects
    // !important width/height caps. Replace that hook with our low-specificity
    // responsive defaults so a book's narrower image sizing remains authoritative.
    const imageAdjustment = rendition.hooks.content
      .list?.()
      .find((hook: { name?: string }) => hook.name === 'bound adjustImages')
    if (imageAdjustment) rendition.hooks.content.deregister(imageAdjustment)
    function applyTheme(dark: boolean) {
      rendition?.themes.default({
        html: {
          'overflow-x': 'hidden !important',
          'overflow-y': 'hidden !important',
          height: 'auto !important',
        },
        ':where(body)': {
          display: 'flow-root',
          'font-family': 'Georgia, serif',
          'font-size': '18px',
          'line-height': '1.7',
          color: dark ? '#e7e9ee' : '#202636',
          'background-color': dark ? '#151b27' : '#ffffff',
          margin: '0',
          padding: '24px',
        },
        body: {
          'box-sizing': 'border-box !important',
          'overflow-x': 'clip !important',
          'overflow-y': 'visible !important',
          height: 'auto !important',
          'min-height': 'calc(100 * var(--papertrail-reader-height)) !important',
        },
        ':where(*)': {
          'max-width': '100%',
          'min-width': '0',
          'overflow-wrap': 'anywhere',
          'box-sizing': 'border-box',
        },
        pre: { 'white-space': 'pre-wrap', 'overflow-wrap': 'anywhere' },
        table: { 'table-layout': 'fixed', 'max-width': '100%' },
        ':where(img, svg)': { 'max-width': '100%', height: 'auto' },
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
      applyBookViewport(doc, root.clientWidth || 1, root.clientHeight || 1)
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
    await displayChapter(publication.chapters[chapterIndex]!.href)
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
    publication.warmChapters(chapterIndex)
    let displayedChapter = chapterIndex
    const session: EpubSession = {
      resolveLink: (chapter, href) => publication.resolveLink(chapter, href),
      get imageWarnings() {
        return publication.imageWarnings
      },
      get fontWarnings() {
        const doc = root.querySelector('iframe')?.contentDocument
        const warning = doc && fontLayoutWarnings.get(doc)
        return [...publication.fontWarnings, ...(warning ? [warning] : [])]
      },
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
        const finish = __READER_DIAGNOSTICS__ ? diagnostics.start('epub.chapter') : undefined
        const owner = ++navigationEpoch
        cancelRestoration()
        lastLocation = undefined
        const previousChapter = chapterIndex
        const sameChapter = chapterIndex === index && displayedChapter === index
        chapterIndex = index
        navigating = true
        try {
          if (!sameChapter) await displayChapter(chapter.href)
          displayedChapter = index
          publication.warmChapters(index)
          signal.throwIfAborted()
          if (owner !== navigationEpoch) throw new Error('EPUB navigation was replaced.')
          if (destroyed) throw new Error('EPUB session is unavailable.')
          const container = root.querySelector<HTMLElement>('.epub-container')
          const iframe = root.querySelector('iframe')
          if (container && iframe) {
            const anchor = fragment ? iframe.contentDocument?.getElementById(fragment) : null
            if (anchor) {
              container.scrollTop +=
                iframe.getBoundingClientRect().top +
                anchor.getBoundingClientRect().top -
                container.getBoundingClientRect().top
              if (!anchor.hasAttribute('tabindex')) anchor.setAttribute('tabindex', '-1')
              ;(anchor as HTMLElement).focus?.({ preventScroll: true })
            } else container.scrollTop = 0
          }
        } catch (error) {
          displayedChapter = -1
          finish?.(diagnosticOutcome(error))
          if (owner === navigationEpoch) chapterIndex = previousChapter
          throw error
        } finally {
          if (owner === navigationEpoch) {
            navigating = false
            bindLocationEvents()
            scheduleResize()
          }
        }
        finish?.()
        signal.throwIfAborted()
        root.querySelector('iframe')?.setAttribute('title', `EPUB chapter: ${chapter.label}`)
      },
      typography(settings) {
        if (destroyed || !rendition || navigating) return
        const settled = __READER_DIAGNOSTICS__ ? measureReflow() : undefined
        try {
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
          settled?.()
        } catch (error) {
          if (__READER_DIAGNOSTICS__) {
            finishReflow?.(diagnosticOutcome(error))
            cancelReflow()
          }
          throw error
        }
      },
      annotationContext() {
        if (destroyed || navigating) return
        const document = root.querySelector('iframe')?.contentDocument
        if (!document?.body) return
        const current = bridge()
        return {
          document,
          chapter: chapterIndex,
          mode,
          ...(current ? { cfiFromRange: (range: Range) => current.cfiFromRange(range) } : {}),
        }
      },
      revealRange(range) {
        if (destroyed || navigating) return false
        const container = root.querySelector<HTMLElement>('.epub-container')
        const frame = root.querySelector('iframe')
        if (!container || !frame) return false
        // An explicit highlight jump replaces any earlier resize/location restoration.
        cancelRestoration()
        if (!scrollHighlightRange(container, range, frame)) return false
        lastLocation = currentLocation()
        return true
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

export async function openEpubSession(
  file: Blob,
  target: HTMLElement,
  signal: AbortSignal,
  options: EpubOpenOptions = {},
): Promise<EpubSession> {
  const finish = __READER_DIAGNOSTICS__ ? diagnostics.start('epub.open-readable') : undefined
  try {
    const session = await createEpubSession(file, target, signal, options)
    finish?.()
    return session
  } catch (error) {
    finish?.(diagnosticOutcome(error))
    throw error
  }
}
