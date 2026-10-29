import { copyBookSemantics } from './book-semantics'
import { ChapterCache, ChapterCacheBudgetError, type PreparedChapter } from './chapter-cache'
import { EPUB_PUBLICATION_LIMITS } from './publication-limits'
import { diagnostics } from '../diagnostics/recorder'
import {
  sanitizeBookCSS,
  stylesheetURLs,
  stylesheetFontURLs,
  withoutBookFontFaces,
} from './book-styles'
import { verifyBookFont, EpubFontError, EPUB_FONT_LIMITS, BookFontPool } from './book-fonts'
import { parseEpubContents, type EpubContentsEntry, type EpubContentsTarget } from './navigation'
import { verifyBookImage, EpubImageLimitError, EPUB_SVG_BYTE_LIMIT } from './book-images'
import { Inflate, strToU8, zipSync } from 'fflate'
import {
  EpubArchiveError,
  EPUB_ARCHIVE_LIMITS,
  preflightEpubArchive,
  type EpubArchiveEntry,
} from './archive-preflight'

function encode(text: string) {
  return new Uint8Array(strToU8(text))
}

export interface TextPublication {
  imageWarnings: readonly string[]
  fontWarnings: readonly string[]
  renderChapter(index: number): Promise<string | undefined>
  isChapterReady(index: number): boolean
  warmChapters(index: number): void
  bytes: ArrayBuffer
  title: string
  dispose(): void
  contents: readonly EpubContentsEntry[]
  contentsSource: 'nav' | 'ncx' | 'spine'
  fragments: readonly ReadonlySet<string>[]
  chapters: readonly { label: string; href: string }[]
}

const crcTable = new Uint32Array(256).map((_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

/** Actual output is bounded independently of untrusted ZIP sizes; no bytes persisted. */
export async function readEpubEntry(
  file: Blob,
  entry: EpubArchiveEntry,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let length = 0
  let crc = 0xffffffff
  const receive = (bytes: Uint8Array) => {
    signal?.throwIfAborted()
    length += bytes.length
    if (length > entry.expandedBytes || length > EPUB_ARCHIVE_LIMITS.entryBytes)
      throw new EpubArchiveError('EPUB resource exceeds its output budget.')
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8)
    chunks.push(bytes.slice())
  }
  const inflater = entry.method === 8 ? new Inflate(receive) : null
  // Small deflate inputs bound the transient output allocation before the callback.
  const step = inflater ? 1024 : 65536
  for (let offset = 0; offset < entry.compressedBytes; offset += step) {
    signal?.throwIfAborted()
    const count = Math.min(step, entry.compressedBytes - offset)
    const bytes = new Uint8Array(
      await file.slice(entry.dataOffset + offset, entry.dataOffset + offset + count).arrayBuffer(),
    )
    signal?.throwIfAborted()
    if (bytes.length !== count) throw new EpubArchiveError('Truncated EPUB resource.')
    if (inflater) inflater.push(bytes, offset + count === entry.compressedBytes)
    else receive(bytes)
    if (offset % (step * 32) === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  if (inflater && entry.compressedBytes === 0) inflater.push(new Uint8Array(), true)
  if (length !== entry.expandedBytes || (crc ^ 0xffffffff) >>> 0 !== entry.crc)
    throw new EpubArchiveError('EPUB resource size or checksum is invalid.')
  signal?.throwIfAborted()
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

function xml(bytes: Uint8Array, limit: number): Document {
  if (bytes.length > limit) throw new EpubArchiveError('EPUB XML resource is too large.')
  let text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  // Standard XHTML declarations are inert after removal; internal subsets stay forbidden.
  text = text.replace(
    /<!DOCTYPE\s+(?:html|ncx)(?:\s+PUBLIC\s+"[^"<>\x5b\x5d]*"\s+"[^"<>\x5b\x5d]*"|\s+SYSTEM\s+"[^"<>\x5b\x5d]*")?\s*>/giu,
    '',
  )
  if (/<!DOCTYPE|<!ENTITY/iu.test(text))
    throw new EpubArchiveError('EPUB XML declarations are unsupported.')
  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (document.querySelector('parsererror')) throw new EpubArchiveError('Malformed EPUB XML.')
  return document
}

function resolvePath(base: string, href: string): string {
  if (
    !href ||
    /[:\\%?#]/u.test(href) ||
    Array.from(href).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    href.startsWith('/')
  )
    throw new EpubArchiveError('Unsupported EPUB resource path.')
  const parts = base.split('/').slice(0, -1)
  for (const part of href.split('/')) {
    if (part === '..') {
      if (!parts.length) throw new EpubArchiveError('EPUB path escapes its archive.')
      parts.pop()
    } else if (part !== '.') {
      if (!part) throw new EpubArchiveError('Empty EPUB path segment.')
      parts.push(part)
    }
  }
  return parts.join('/')
}

const XHTML = 'http://www.w3.org/1999/xhtml'
const SVG = 'http://www.w3.org/2000/svg'
/** Recognize simple image wrappers; only an application-built SVG wrapper may render. */
function coverImage(element: Element): Element | undefined {
  if (element.namespaceURI !== SVG || element.localName !== 'svg') return
  const children = [...element.children]
  if (
    children.some(
      (child) =>
        child.namespaceURI !== SVG || !['image', 'title', 'desc'].includes(child.localName),
    )
  )
    return
  const images = children.filter((child) => child.localName === 'image')
  if (images.length === 1 && !images[0]!.children.length) return images[0]
}
const allowed = new Set(
  'a main hgroup header footer aside address p div span h1 h2 h3 h4 h5 h6 blockquote pre code em strong b i u s small sup sub br hr ul ol li dl dt dd table thead tbody tfoot tr th td caption figure figcaption section article'.split(
    ' ',
  ),
)
const discarded = new Set(
  'script style iframe object embed form input button textarea select link meta base svg math audio video source'.split(
    ' ',
  ),
)
export const EPUB_TEXT_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"

/** Rebuild a fresh XHTML tree, never insert the original document into a live DOM. */
export function sanitizeChapter(
  source: Document,
  formatting?: {
    sheets: string[]
    images: Map<Element, string>
    inline: Map<Element, string>
    fonts?: boolean
  },
): string {
  const body = source.getElementsByTagNameNS(XHTML, 'body')[0]
  if (!body) throw new EpubArchiveError('EPUB chapter has no XHTML body.')
  const output = document.implementation.createDocument(XHTML, 'html')
  const head = output.createElementNS(XHTML, 'head')
  const policy = output.createElementNS(XHTML, 'meta')
  policy.setAttribute('http-equiv', 'Content-Security-Policy')
  policy.setAttribute(
    'content',
    formatting
      ? EPUB_TEXT_CSP.replace("img-src 'none'", 'img-src blob:').replace(
          "font-src 'none'",
          formatting.fonts ? 'font-src blob:' : "font-src 'none'",
        )
      : EPUB_TEXT_CSP,
  )
  head.append(policy)
  if (formatting)
    for (const css of formatting.sheets) {
      const style = output.createElementNS(XHTML, 'style')
      style.textContent = css
      head.append(style)
    }
  const target = output.createElementNS(XHTML, 'body')
  const direction = body.getAttribute('dir') ?? source.documentElement.getAttribute('dir')
  if (direction === 'rtl' || direction === 'ltr') target.setAttribute('dir', direction)
  function attributes(from: Element, to: Element) {
    copyBookSemantics(from, to)
    const id = from.getAttribute('id')
    if (
      id &&
      id.length <= 256 &&
      !id.startsWith('epubjs-') &&
      !id.startsWith('papertrail-') &&
      !/\s/u.test(id) &&
      Array.from(id).every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    )
      to.setAttribute('id', id)
    if (!formatting) return
    for (const name of ['class', 'lang', 'title']) {
      const value = from.getAttribute(name)
      if (value && value.length <= 1000) to.setAttribute(name, value)
    }
    const css = formatting.inline.get(from)
    if (css) to.setAttribute('style', css)
    for (const name of ['colspan', 'rowspan', 'start', 'value']) {
      const value = from.getAttribute(name)
      if (value && /^\d{1,3}$/u.test(value)) to.setAttribute(name, value)
    }
  }
  attributes(source.documentElement, output.documentElement)
  attributes(body, target)
  output.documentElement.append(head, target)
  let nodes = 0
  function copy(node: Node, parent: Node, depth: number) {
    if (++nodes > 100000 || depth > 100)
      throw new EpubArchiveError('EPUB chapter structure is too complex.')
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(output.createTextNode(node.textContent ?? ''))
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as Element
    const tag = element.localName.toLowerCase()
    const cover = coverImage(element)
    if (cover) {
      const url = formatting?.images.get(element)
      const fresh = output.createElementNS(url ? SVG : XHTML, url ? 'svg' : 'span')
      attributes(element, fresh)
      fresh.setAttribute('data-reader-node', `pt-${nodes}`)
      fresh.setAttribute('data-reader-image', '')
      const alt = (
        element.getElementsByTagNameNS(SVG, 'title')[0]?.textContent || 'Book illustration'
      ).slice(0, 1000)
      if (url) {
        fresh.setAttribute('role', 'img')
        fresh.setAttribute('aria-label', alt)
        const viewBox = element.getAttribute('viewBox')
        if (viewBox && /^[\d.eE+\-,\s]+$/u.test(viewBox) && viewBox.length < 200)
          fresh.setAttribute('viewBox', viewBox)
        const image = output.createElementNS(SVG, 'image')
        attributes(cover, image)
        image.setAttribute('href', url)
        for (const name of ['width', 'height', 'x', 'y']) {
          for (const [from, to] of [
            [element, fresh],
            [cover, image],
          ] as const) {
            const value = from.getAttribute(name)
            if (value && /^[-+]?(?:\d*\.)?\d+(?:px|%)?$/u.test(value) && value.length < 30)
              to.setAttribute(name, value)
          }
        }
        for (const [from, to] of [
          [element, fresh],
          [cover, image],
        ] as const) {
          const aspect = from.getAttribute('preserveAspectRatio')
          if (
            aspect &&
            /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/u.test(aspect)
          )
            to.setAttribute('preserveAspectRatio', aspect)
        }
        fresh.append(image)
      } else fresh.textContent = alt
      parent.appendChild(fresh)
      return
    }
    if (element.namespaceURI !== XHTML || discarded.has(tag)) return
    // Only verified local images enter formatted view; retain alternate text otherwise.
    if (tag === 'img') {
      const url = formatting?.images.get(element)
      if (url) {
        const img = output.createElementNS(XHTML, 'img')
        attributes(element, img)
        img.setAttribute('data-reader-node', `pt-${nodes}`)
        img.setAttribute('data-reader-image', '')
        img.setAttribute('src', url)
        img.setAttribute('alt', (element.getAttribute('alt') ?? '').slice(0, 1000))
        for (const name of ['width', 'height']) {
          const value = element.getAttribute(name)
          if (value && /^\d{1,4}$/u.test(value)) img.setAttribute(name, value)
        }
        parent.appendChild(img)
      } else {
        const alt = output.createElementNS(XHTML, 'span')
        attributes(element, alt)
        alt.setAttribute('data-reader-node', `pt-${nodes}`)
        alt.setAttribute('data-reader-image', '')
        alt.textContent =
          element.getAttribute('alt') || (formatting ? 'Illustration unavailable.' : '')
        parent.appendChild(alt)
      }
      return
    }
    const fresh = allowed.has(tag) ? output.createElementNS(XHTML, tag) : null
    if (fresh) {
      attributes(element, fresh)
      fresh.setAttribute('data-reader-node', `pt-${nodes}`)
      const dir = element.getAttribute('dir')
      if (dir === 'rtl' || dir === 'ltr') fresh.setAttribute('dir', dir)
      parent.appendChild(fresh)
    }
    for (const child of element.childNodes) copy(child, fresh ?? parent, depth + 1)
  }
  for (const child of body.childNodes) copy(child, target, 0)
  return new XMLSerializer().serializeToString(output)
}

/** Build an inert EPUB for epub.js from verified local publication data. */
export async function preparePublication(
  file: Blob,
  signal?: AbortSignal,
  textOnly = false,
  deferFormatting = false,
): Promise<TextPublication> {
  const ownedURLs: string[] = []
  const fontPool = new BookFontPool()
  const releaseURL = (url: string) => {
    if (!fontPool.release(url)) URL.revokeObjectURL(url)
  }
  let ownedBlobBytes = 0
  let ownedImageBytes = 0
  let disposed = false
  let cache: ChapterCache | undefined
  let requestedChapter = -1
  let workSignal = signal
  let resourceAllowance = 32 * 1024 * 1024 + EPUB_FONT_LIMITS.chapterBytes
  let fontAllowance = EPUB_FONT_LIMITS.chapterBytes
  let clearChapter = () => {}
  function ensureOpen() {
    signal?.throwIfAborted()
    workSignal?.throwIfAborted()
    if (disposed) throw new DOMException('EPUB publication was disposed.', 'AbortError')
  }
  const releaseResources = () => {
    for (const url of ownedURLs.splice(0)) releaseURL(url)
    ownedBlobBytes = ownedImageBytes = 0
    if (__READER_DIAGNOSTICS__) diagnostics.release(ownedURLs)
  }
  const dispose = () => {
    disposed = true
    cache?.dispose()
    releaseResources()
    clearChapter()
  }
  try {
    const entries = await preflightEpubArchive(file, signal)
    const byPath = new Map(entries.map((entry) => [entry.path, entry]))
    if (byPath.has('META-INF/encryption.xml'))
      throw new EpubArchiveError('Encrypted or obfuscated EPUB publications are unsupported.')
    async function resource(path: string, limit: number) {
      const entry = byPath.get(path)
      if (!entry || entry.expandedBytes > limit)
        throw new EpubArchiveError('EPUB resource is missing or too large.')
      return xml(await readEpubEntry(file, entry, workSignal), limit)
    }
    const container = await resource('META-INF/container.xml', 256 * 1024)
    if (
      container.documentElement.localName !== 'container' ||
      container.documentElement.namespaceURI !== 'urn:oasis:names:tc:opendocument:xmlns:container'
    )
      throw new EpubArchiveError('Invalid EPUB container.')
    const roots = [
      ...container.getElementsByTagNameNS(
        'urn:oasis:names:tc:opendocument:xmlns:container',
        'rootfile',
      ),
    ]
    const root = roots.find(
      (item) => item.getAttribute('media-type') === 'application/oebps-package+xml',
    )
    if (!root) throw new EpubArchiveError('EPUB package declaration is missing.')
    const packagePath = resolvePath('', root.getAttribute('full-path') ?? '')
    const packageDoc = await resource(packagePath, 1024 * 1024)
    const ns = 'http://www.idpf.org/2007/opf'
    if (
      packageDoc.documentElement.localName !== 'package' ||
      packageDoc.documentElement.namespaceURI !== ns
    )
      throw new EpubArchiveError('Invalid EPUB package.')
    if (!/^[23](?:\.\d+)?$/u.test(packageDoc.documentElement.getAttribute('version') ?? ''))
      throw new EpubArchiveError('Unsupported EPUB version.')
    if (
      [...packageDoc.getElementsByTagNameNS(ns, 'meta')].some(
        (item) =>
          item.getAttribute('property') === 'rendition:layout' &&
          item.textContent?.trim() === 'pre-paginated',
      )
    )
      throw new EpubArchiveError('Fixed-layout EPUB is unsupported in this reflowable reader.')
    const title = (
      packageDoc
        .getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')[0]
        ?.textContent?.trim() || 'Local EPUB'
    ).slice(0, 300)
    const items = new Map<string, Element>()
    const manifest = packageDoc.getElementsByTagNameNS(ns, 'manifest')[0]
    const spine = packageDoc.getElementsByTagNameNS(ns, 'spine')[0]
    if (!manifest || !spine) throw new EpubArchiveError('EPUB manifest or spine is missing.')
    for (const item of manifest.children) {
      const id = item.getAttribute('id')
      if (item.localName !== 'item' || item.namespaceURI !== ns || !id || items.has(id))
        throw new EpubArchiveError('Invalid EPUB manifest item.')
      items.set(id, item)
    }
    const refs = [...spine.children].filter((item) => item.getAttribute('linear') !== 'no')
    if (!refs.length) throw new EpubArchiveError('EPUB has no linear reading-order sections.')
    if (refs.length > EPUB_PUBLICATION_LIMITS.spineEntries)
      throw new EpubArchiveError(
        `EPUB has ${refs.length} linear reading-order sections; the supported limit is ${EPUB_PUBLICATION_LIMITS.spineEntries}. Choose a book with fewer sections.`,
      )
    const manifestPaths = new Map<string, string>()
    for (const item of items.values()) {
      try {
        manifestPaths.set(
          resolvePath(packagePath, item.getAttribute('href') ?? ''),
          item.getAttribute('media-type') ?? '',
        )
      } catch {
        /* remote/unsupported resources are omitted */
      }
    }
    const imageCache = new Map<string, string | null>()
    const imageWarnings = new Set<string>()
    const svgURLs = new Set<string>()
    let imageTotal = 0
    let imageCount = 0
    let imageWorkBytes = 0
    let imageAttempts = 0
    async function image(base: string, href: string): Promise<string | null> {
      ensureOpen()
      let path: string
      try {
        path = resolvePath(base, href)
      } catch {
        return null
      }
      if (imageCache.has(path)) return imageCache.get(path)!
      imageCache.set(path, null)
      const mime = manifestPaths.get(path)
      if (
        !mime ||
        !['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'].includes(mime)
      )
        return null
      const entry = byPath.get(path)
      // Omit oversized SVGs before reading/parsing them. Count and total-image
      // budgets still apply independently; this is not unrestricted image support.
      if (mime === 'image/svg+xml' && entry && entry.expandedBytes > EPUB_SVG_BYTE_LIMIT) {
        imageWarnings.add('SVG illustration exceeds the 4 MiB size limit.')
        return null
      }
      if (!entry) return null
      if (entry.expandedBytes > 8 * 1024 * 1024) {
        imageWarnings.add('Illustration exceeds the 8 MiB image size limit.')
        return null
      }
      if (imageCount >= 128 || imageTotal + entry.expandedBytes > 32 * 1024 * 1024) {
        imageWarnings.add(
          'Additional illustrations exceed this chapter’s image budget (128 images / 32 MiB).',
        )
        return null
      }
      if (imageAttempts >= 256 || imageWorkBytes + entry.expandedBytes > 32 * 1024 * 1024) {
        imageWarnings.add(
          'Additional illustrations exceed this chapter’s image-validation work budget.',
        )
        return null
      }
      imageAttempts++
      imageWorkBytes += entry.expandedBytes
      const input = await readEpubEntry(file, entry, workSignal)
      let bytes: Uint8Array | null
      try {
        bytes = verifyBookImage(input, mime)
      } catch (error) {
        if (!(error instanceof EpubImageLimitError)) throw error
        imageWarnings.add(error.message)
        return null
      }
      if (!bytes) {
        if (mime === 'image/svg+xml')
          imageWarnings.add('SVG illustration is malformed or uses an unsupported format.')
        return null
      }
      if (ownedImageBytes + bytes.byteLength > 32 * 1024 * 1024) {
        imageWarnings.add(
          'Additional illustrations exceed this chapter’s 32 MiB live-image budget.',
        )
        return null
      }
      ensureOpen()
      if (ownedBlobBytes + bytes.byteLength > resourceAllowance)
        throw new ChapterCacheBudgetError('Adjacent chapter cache is full.')
      imageTotal += entry.expandedBytes
      imageCount++
      const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }))
      ownedURLs.push(url)
      if (mime === 'image/svg+xml') svgURLs.add(url)
      ownedBlobBytes += bytes.byteLength
      ownedImageBytes += bytes.byteLength
      if (__READER_DIAGNOSTICS__)
        diagnostics.resources(ownedURLs, { blobURLs: ownedURLs.length, blobBytes: ownedBlobBytes })
      imageCache.set(path, url)
      return url
    }
    const fontCache = new Map<string, string | null>()
    const fontWarnings = new Set<string>()
    let fontCount = 0,
      fontBytes = 0,
      fontAttempts = 0,
      fontWork = 0
    const fontState = {
      remaining: EPUB_FONT_LIMITS.faces,
      warn: () =>
        fontWarnings.add(
          'Some embedded font declarations are unsupported or exceed the chapter face limit. Fallback fonts are used.',
        ),
    }
    async function font(base: string, href: string): Promise<string | null> {
      ensureOpen()
      let path: string
      try {
        path = resolvePath(base, href)
      } catch {
        fontWarnings.add(
          'Remote or unsupported font sources are unavailable. Fallback fonts are used.',
        )
        return null
      }
      if (fontCache.has(path)) return fontCache.get(path)!
      fontCache.set(path, null)
      const mime = manifestPaths.get(path),
        entry = byPath.get(path)
      if (
        !entry ||
        !mime ||
        ![
          'font/woff',
          'font/woff2',
          'font/ttf',
          'font/otf',
          'application/font-woff',
          'application/vnd.ms-opentype',
          'application/x-font-ttf',
          'application/x-font-opentype',
          'application/font-sfnt',
        ].includes(mime)
      ) {
        fontWarnings.add(
          'An embedded font is missing or uses an unsupported manifest type. Fallback fonts are used.',
        )
        return null
      }
      if (
        entry.expandedBytes > EPUB_FONT_LIMITS.inputBytes ||
        fontCount >= EPUB_FONT_LIMITS.faces ||
        fontAttempts >= EPUB_FONT_LIMITS.attempts ||
        fontWork + entry.expandedBytes > EPUB_FONT_LIMITS.workBytes ||
        fontBytes + entry.expandedBytes > Math.min(EPUB_FONT_LIMITS.chapterBytes, fontAllowance)
      ) {
        fontWarnings.add(
          'Embedded fonts exceed their input, chapter or available cache budget. Fallback fonts are used.',
        )
        return null
      }
      fontAttempts++
      fontWork += entry.expandedBytes
      const retained = fontPool.acquire(path)
      if (retained) {
        if (ownedBlobBytes + retained.bytes > resourceAllowance) {
          fontPool.release(retained.url)
          throw new ChapterCacheBudgetError('Adjacent chapter cache is full.')
        }
        ownedURLs.push(retained.url)
        ownedBlobBytes += retained.bytes
        fontBytes += retained.bytes
        fontCount++
        fontCache.set(path, retained.url)
        if (__READER_DIAGNOSTICS__)
          diagnostics.resources(ownedURLs, {
            blobURLs: ownedURLs.length,
            blobBytes: ownedBlobBytes,
          })
        return retained.url
      }
      const bytes = await readEpubEntry(file, entry, workSignal)
      let type: string
      try {
        type = verifyBookFont(bytes)
      } catch (error) {
        if (!(error instanceof EpubFontError)) throw error
        fontWarnings.add(
          'An embedded font is malformed, unsupported or oversized. Fallback fonts are used.',
        )
        return null
      }
      ensureOpen()
      if (ownedBlobBytes + bytes.byteLength > resourceAllowance)
        throw new ChapterCacheBudgetError('Adjacent chapter cache is full.')
      const { url } = fontPool.add(path, bytes, type)
      ownedURLs.push(url)
      ownedBlobBytes += bytes.byteLength
      fontBytes += bytes.byteLength
      fontCount++
      if (__READER_DIAGNOSTICS__)
        diagnostics.resources(ownedURLs, { blobURLs: ownedURLs.length, blobBytes: ownedBlobBytes })
      fontCache.set(path, url)
      return url
    }
    let cssTotal = 0
    const cssCache = new Map<string, string>()
    clearChapter = () => {
      imageCache.clear()
      fontCache.clear()
      fontWarnings.clear()
      fontCount = fontBytes = fontAttempts = fontWork = 0
      fontState.remaining = EPUB_FONT_LIMITS.faces
      svgURLs.clear()
      cssCache.clear()
      imageWarnings.clear()
    }
    async function css(text: string, base: string, inline = false) {
      cssTotal += text.length
      if (cssTotal > 2 * 1024 * 1024)
        throw new EpubArchiveError('EPUB styles exceed their reading budget.')
      const urls = new Map<string, string>()
      for (const href of stylesheetURLs(text, inline)) {
        const url = await image(base, href)
        if (url) urls.set(href, url)
      }
      const fonts = new Map<string, string>()
      if (!inline)
        for (const href of stylesheetFontURLs(text)) {
          const url = await font(base, href)
          if (url) fonts.set(href, url)
        }
      return sanitizeBookCSS(text, urls, inline, fonts, fontState)
    }
    async function formatting(chapter: Document, path: string) {
      const sheets: string[] = []
      const linkedSheets = new Set<string>()
      const images = new Map<Element, string>()
      const inline = new Map<Element, string>()
      const elements = [...chapter.getElementsByTagName('*')]
      if (elements.length > 100000) throw new EpubArchiveError('EPUB chapter is too complex.')
      for (const element of elements) {
        ensureOpen()
        const cover = coverImage(element)
        if (cover) {
          const href =
            cover.getAttribute('href') ??
            cover.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ??
            ''
          const url = await image(path, href)
          if (url) images.set(element, url)
          for (const node of [element, cover]) {
            const style = node.getAttribute('style')
            if (style) inline.set(node, await css(style, path, true))
          }
        }
        if (element.namespaceURI !== XHTML) continue
        if (element.localName === 'style') sheets.push(await css(element.textContent ?? '', path))
        if (
          element.localName === 'link' &&
          element.getAttribute('rel')?.toLowerCase() === 'stylesheet'
        ) {
          let href: string
          try {
            href = resolvePath(path, element.getAttribute('href') ?? '')
          } catch {
            continue
          }
          if (manifestPaths.get(href) !== 'text/css') continue
          let clean = cssCache.get(href)
          if (clean === undefined) {
            const entry = byPath.get(href)
            if (!entry || entry.expandedBytes > 256 * 1024)
              throw new EpubArchiveError('EPUB stylesheet is missing or too large.')
            clean = await css(
              new TextDecoder('utf-8', { fatal: true }).decode(
                await readEpubEntry(file, entry, workSignal),
              ),
              href,
            )
            cssCache.set(href, clean)
          }
          sheets.push(linkedSheets.has(href) ? withoutBookFontFaces(clean) : clean)
          linkedSheets.add(href)
        }
        const style = element.getAttribute('style')
        if (style) inline.set(element, await css(style, path, true))
        if (element.localName === 'img') {
          const url = await image(path, element.getAttribute('src') ?? '')
          if (url) images.set(element, url)
        }
      }
      return { sheets, images, inline, fonts: fontBytes > 0 }
    }
    const chapters: { label: string; href: string }[] = []
    const chapterPaths: string[] = []
    const fragments: Set<string>[] = []
    const targets = new Map<string, { chapter: number; fragments: Set<string> }>()
    const files: Record<string, Uint8Array> = { mimetype: encode('application/epub+zip') }
    let total = 0
    let inputTotal = 0
    const spinePaths = new Set<string>()
    for (const [index, ref] of refs.entries()) {
      signal?.throwIfAborted()
      if (
        ref.localName !== 'itemref' ||
        ref.namespaceURI !== ns ||
        ref.getAttribute('properties')?.includes('rendition:layout-pre-paginated')
      )
        throw new EpubArchiveError('Unsupported EPUB spine item.')
      const item = items.get(ref.getAttribute('idref') ?? '')
      if (!item || item.getAttribute('media-type') !== 'application/xhtml+xml')
        throw new EpubArchiveError('EPUB spine resource is not XHTML.')
      const path = resolvePath(packagePath, item.getAttribute('href') ?? '')
      if (spinePaths.has(path))
        throw new EpubArchiveError('Repeated EPUB spine resources are unsupported.')
      spinePaths.add(path)
      chapterPaths.push(path)
      inputTotal += byPath.get(path)?.expandedBytes ?? 0
      if (inputTotal > 32 * 1024 * 1024)
        throw new EpubArchiveError('EPUB chapter input exceeds the reading budget.')
      const chapter = await resource(path, 4 * 1024 * 1024)
      const href = `chapter-${index}.xhtml`
      const cleanText = sanitizeChapter(
        chapter,
        textOnly
          ? undefined
          : deferFormatting
            ? { sheets: [], images: new Map(), inline: new Map() }
            : await formatting(chapter, path),
      )
      const clean = encode(cleanText)
      const sanitized = new DOMParser().parseFromString(cleanText, 'application/xml')
      const ids = new Set<string>()
      const duplicateIds = new Set<string>()
      for (const el of sanitized.querySelectorAll('[id]')) {
        const id = el.getAttribute('id')!
        if (ids.has(id)) duplicateIds.add(id)
        ids.add(id)
      }
      for (const id of duplicateIds) ids.delete(id)
      fragments.push(ids)
      targets.set(path, { chapter: index, fragments: ids })
      total += clean.length
      if (total > 32 * 1024 * 1024)
        throw new EpubArchiveError('EPUB text exceeds the reading budget.')
      files[href] = clean
      chapters.push({
        label: (
          chapter.getElementsByTagNameNS(XHTML, 'title')[0]?.textContent?.trim() ||
          `Chapter ${index + 1}`
        ).slice(0, 200),
        href,
      })
    }
    let contents: EpubContentsEntry[] = []
    let contentsSource: 'nav' | 'ncx' | 'spine' = 'spine'
    const navItem = [...items.values()].find(
      (item) =>
        item.getAttribute('media-type') === 'application/xhtml+xml' &&
        item.getAttribute('properties')?.split(/\s+/u).includes('nav'),
    )
    const ncxItem =
      items.get(spine.getAttribute('toc') ?? '') ??
      [...items.values()].find(
        (item) => item.getAttribute('media-type') === 'application/x-dtbncx+xml',
      )
    for (const [kind, item] of [
      ['nav', navItem],
      ['ncx', ncxItem],
    ] as const) {
      if (
        contents.length ||
        !item ||
        (kind === 'ncx' && item.getAttribute('media-type') !== 'application/x-dtbncx+xml')
      )
        continue
      try {
        const path = resolvePath(packagePath, item.getAttribute('href') ?? '')
        const navDocument = await resource(path, 1024 * 1024)
        const resolveTarget = (href: string): EpubContentsTarget | null => {
          try {
            const parts = href.split('#')
            if (parts.length > 2) return null
            const target = targets.get(parts[0] ? resolvePath(path, parts[0]) : path)
            if (!target) return null
            const fragment = parts[1] ? decodeURIComponent(parts[1]) : undefined
            if (fragment && !target.fragments.has(fragment)) return null
            return { chapter: target.chapter, fragment }
          } catch {
            return null
          }
        }
        const parsed = parseEpubContents(navDocument, kind, resolveTarget)
        if (parsed.length) {
          contents = parsed
          contentsSource = kind
        }
      } catch {
        signal?.throwIfAborted()
        // Optional navigation failure must not prevent reading verified spine chapters.
      }
    }
    if (!contents.length)
      contents = chapters.map((chapter, index) => ({
        id: `spine-${index}`,
        label: chapter.label,
        chapter: index,
        children: [],
      }))
    // Only rebuilt XHTML, sanitized CSS and owned image/font URLs reach the engine.
    files.mimetype = encode('application/epub+zip')
    files['META-INF/container.xml'] = encode(
      '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    )
    files['package.opf'] = encode(
      `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">papertrail-local-text</dc:identifier><dc:title>Local EPUB</dc:title><dc:language>en</dc:language></metadata><manifest>${chapters.map((chapter, index) => `<item id="c${index}" href="${chapter.href}" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${chapters.map((_, index) => `<itemref idref="c${index}"/>`).join('')}</spine></package>`,
    )
    signal?.throwIfAborted()
    const packed = zipSync(files, { level: 0 })
    async function buildChapter(
      index: number,
      buildSignal: AbortSignal,
      budget: number,
    ): Promise<PreparedChapter> {
      ensureOpen()
      releaseResources()
      clearChapter()
      imageTotal = imageCount = imageWorkBytes = imageAttempts = cssTotal = 0
      workSignal = buildSignal
      resourceAllowance = budget - 4 * 1024 * 1024
      // Preserve the existing full image allowance; skip speculative font ownership
      // if the shared pool cannot hold it alongside the departing chapter.
      fontAllowance = Math.max(
        0,
        Math.min(EPUB_FONT_LIMITS.chapterBytes, resourceAllowance - 32 * 1024 * 1024),
      )
      try {
        const path = chapterPaths[index]!
        const chapter = await resource(path, 4 * 1024 * 1024)
        const formatted = await formatting(chapter, path)
        ensureOpen()
        const markup = sanitizeChapter(chapter, formatted)
        const markupBytes = encode(markup).length
        if (markupBytes > 4 * 1024 * 1024)
          throw new EpubArchiveError('Formatted EPUB chapter exceeds its reading budget.')
        // Warm vector decodes sequentially and yield between resources. Do not
        // force speculative raster bitmap decoding for off-screen chapters.
        for (const url of svgURLs) {
          ensureOpen()
          const img = typeof Image !== 'undefined' ? new Image() : undefined
          if (!img?.decode) continue
          await new Promise<void>((resolve, reject) => {
            const cancel = () => {
              img.src = ''
              reject(new DOMException('Image preload cancelled.', 'AbortError'))
            }
            buildSignal.addEventListener('abort', cancel, { once: true })
            img.src = url
            img
              .decode()
              .then(resolve, () => resolve())
              .finally(() => buildSignal.removeEventListener('abort', cancel))
            if (buildSignal.aborted) cancel()
          })
          await new Promise<void>((resolve) => setTimeout(resolve, 0))
        }
        ensureOpen()
        const urls = ownedURLs.splice(0)
        const blobBytes = ownedBlobBytes
        ownedBlobBytes = ownedImageBytes = 0
        if (__READER_DIAGNOSTICS__) diagnostics.release(ownedURLs)
        let released = false
        const prepared: PreparedChapter = {
          markup,
          warnings: [...imageWarnings],
          fontWarnings: [...fontWarnings],
          bytes: markupBytes + blobBytes,
          dispose() {
            if (released) return
            released = true
            for (const url of urls) releaseURL(url)
            if (__READER_DIAGNOSTICS__) diagnostics.release(prepared)
          },
        }
        if (__READER_DIAGNOSTICS__)
          diagnostics.resources(prepared, { blobURLs: urls.length, blobBytes })
        return prepared
      } catch (error) {
        releaseResources()
        throw error
      } finally {
        clearChapter()
        workSignal = signal
        resourceAllowance = 32 * 1024 * 1024 + EPUB_FONT_LIMITS.chapterBytes
        fontAllowance = EPUB_FONT_LIMITS.chapterBytes
      }
    }
    if (!textOnly && deferFormatting) cache = new ChapterCache(buildChapter, chapters.length)
    async function renderChapter(index: number): Promise<string | undefined> {
      ensureOpen()
      if (!chapterPaths[index]) throw new EpubArchiveError('EPUB chapter is unavailable.')
      if (!cache) return undefined
      requestedChapter = index
      cache.focus(index)
      return (await cache.prepare(index)).markup
    }
    return {
      get imageWarnings() {
        return cache ? (cache.get(requestedChapter)?.warnings ?? []) : [...imageWarnings]
      },
      get fontWarnings() {
        return cache ? (cache.get(requestedChapter)?.fontWarnings ?? []) : [...fontWarnings]
      },
      renderChapter,
      isChapterReady(index) {
        return textOnly || !!cache?.ready(index)
      },
      warmChapters(index) {
        if (disposed || !cache?.ready(index)) return
        cache.commit(index)
        void cache.warm()
      },
      title,
      dispose,
      chapters,
      fragments,
      contents,
      contentsSource,
      bytes: packed.buffer.slice(
        packed.byteOffset,
        packed.byteOffset + packed.byteLength,
      ) as ArrayBuffer,
    }
  } catch (error) {
    dispose()
    throw error
  }
}

export function prepareTextPublication(file: Blob, signal?: AbortSignal) {
  return preparePublication(file, signal, true)
}
