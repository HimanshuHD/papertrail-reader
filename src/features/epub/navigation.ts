import { EpubArchiveError } from './archive-preflight'

export interface EpubContentsEntry {
  id: string
  label: string
  chapter: number | null
  fragment?: string
  children: readonly EpubContentsEntry[]
}
export interface EpubContentsTarget {
  chapter: number
  fragment?: string
}
const XHTML = 'http://www.w3.org/1999/xhtml'
const OPS = 'http://www.idpf.org/2007/ops'
const NCX = 'http://www.daisy.org/z3986/2005/ncx/'

/** Only labels and validated targets leave this parser; source markup is never inserted. */
export function parseEpubContents(
  document: Document,
  kind: 'nav' | 'ncx',
  resolve: (href: string) => EpubContentsTarget | null,
): EpubContentsEntry[] {
  if (document.getElementsByTagName('*').length > 8192)
    throw new EpubArchiveError('EPUB navigation structure exceeds its budget.')
  let count = 0
  const ns = kind === 'nav' ? XHTML : NCX
  function child(element: Element, tag: string) {
    return [...element.children].find((el) => el.namespaceURI === ns && el.localName === tag)
  }
  function read(parent: Element, depth: number): EpubContentsEntry[] {
    if (depth > 16) throw new EpubArchiveError('EPUB navigation nesting exceeds its budget.')
    const entries: EpubContentsEntry[] = []
    for (const element of parent.children) {
      if (element.namespaceURI !== ns || element.localName !== (kind === 'nav' ? 'li' : 'navPoint'))
        continue
      if (++count > 512) throw new EpubArchiveError('EPUB navigation entries exceed their budget.')
      const id = `contents-${count}`
      const labelElement =
        kind === 'nav'
          ? [...element.children].find(
              (el) => el.namespaceURI === XHTML && ['a', 'span'].includes(el.localName),
            )
          : child(element, 'navLabel') && child(child(element, 'navLabel')!, 'text')
      const label = labelElement?.textContent?.replace(/\s+/gu, ' ').trim().slice(0, 200) ?? ''
      const href =
        kind === 'nav'
          ? labelElement?.localName === 'a'
            ? labelElement.getAttribute('href')
            : null
          : child(element, 'content')?.getAttribute('src')
      const target = href ? resolve(href) : null
      const nested = kind === 'nav' ? child(element, 'ol') : element
      const children = nested ? read(nested, depth + 1) : []
      if (label && (target || children.length))
        entries.push({
          id,
          label,
          chapter: target?.chapter ?? null,
          fragment: target?.fragment,
          children,
        })
      else entries.push(...children)
    }
    return entries
  }
  if (kind === 'nav') {
    if (
      document.documentElement.namespaceURI !== XHTML ||
      document.documentElement.localName !== 'html'
    )
      return []
    const nav = [...document.getElementsByTagNameNS(XHTML, 'nav')].find((el) =>
      el.getAttributeNS(OPS, 'type')?.split(/\s+/u).includes('toc'),
    )
    const ol = nav && child(nav, 'ol')
    return ol ? read(ol, 0) : []
  }
  if (document.documentElement.namespaceURI !== NCX || document.documentElement.localName !== 'ncx')
    return []
  const map = child(document.documentElement, 'navMap')
  return map ? read(map, 0) : []
}

export function flattenContents(entries: readonly EpubContentsEntry[]): EpubContentsEntry[] {
  return entries.flatMap((entry) => [entry, ...flattenContents(entry.children)])
}
