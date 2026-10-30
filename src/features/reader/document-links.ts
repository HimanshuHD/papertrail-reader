export type DocumentLink =
  | { kind: 'external'; url: string }
  | { kind: 'epub'; chapter: number; fragment?: string }
  | { kind: 'pdf'; destination: string | unknown[] }
  | { kind: 'blocked'; message: string }
export const unavailableLink = (): DocumentLink => ({
  kind: 'blocked',
  message: 'This link destination is unavailable or unsupported.',
})
function badCharacters(value: string) {
  return Array.from(value).some(
    (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === '\\',
  )
}
export function externalLink(value: string): DocumentLink {
  if (value.length > 4096 || badCharacters(value)) return unavailableLink()
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      return unavailableLink()
    return { kind: 'external', url: url.href }
  } catch {
    return unavailableLink()
  }
}
export function epubContentLink(
  base: string,
  href: string,
  targets: ReadonlyMap<string, { chapter: number; fragments: ReadonlySet<string> }>,
): DocumentLink {
  if (!base || !href || href === '!unsupported' || href.length > 4096 || badCharacters(href))
    return unavailableLink()
  href = href.trim()
  if (/^[a-z][a-z\d+.-]*:/iu.test(href) || href.startsWith('//')) return externalLink(href)
  if (href.startsWith('/') || href.includes('?')) return unavailableLink()
  try {
    const pieces = href.split('#')
    if (pieces.length > 2) return unavailableLink()
    const path = pieces[0]!,
      parts = base.split('/')
    if (path) {
      parts.pop()
      for (const encoded of path.split('/')) {
        const part = decodeURIComponent(encoded)
        if (badCharacters(part) || /[/:]/u.test(part)) return unavailableLink()
        if (part === '..') {
          if (!parts.length) return unavailableLink()
          parts.pop()
        } else if (part && part !== '.') parts.push(part)
      }
    }
    const target = targets.get(parts.join('/')),
      fragment = pieces[1] ? decodeURIComponent(pieces[1]) : undefined
    if (!target || (fragment && !target.fragments.has(fragment))) return unavailableLink()
    return { kind: 'epub', chapter: target.chapter, ...(fragment ? { fragment } : {}) }
  } catch {
    return unavailableLink()
  }
}
/** Keep unsupported source actions inert without retaining script or credential payloads. */
export function inertLinkValue(value: string): string {
  if (value.length > 4096 || badCharacters(value)) return '!unsupported'
  value = value.trim()
  if (/^[a-z][a-z\d+.-]*:/iu.test(value) || value.startsWith('//')) {
    const checked = externalLink(value)
    return checked.kind === 'external' ? checked.url : '!unsupported'
  }
  return value
}
/** No native href: modifiers and middle-click cannot bypass explicit consent. */
export function bindDocumentLinks(
  root: HTMLElement | Document,
  resolve: (element: HTMLElement) => DocumentLink,
  activate: (link: DocumentLink, origin: HTMLElement) => void,
) {
  let middlePressed: HTMLElement | null = null
  let middleActivated: HTMLElement | null = null
  const names = ['pointerdown', 'pointerup', 'click', 'auxclick', 'keydown'] as const
  const handle = (event: Event) => {
    const mouse = event as MouseEvent
    if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Enter') return
    const link = (event.target as Element | null)?.closest?.<HTMLElement>('[data-reader-link]')
    if (event.type === 'pointerdown') {
      middleActivated = null
      middlePressed = mouse.button === 1 && link && root.contains(link) ? link : null
      // Prevent Windows autoscroll before it consumes the middle-button release.
      if (middlePressed) event.preventDefault()
      return
    }
    if (!link || !root.contains(link)) return
    if (event.type === 'click' && mouse.button !== 0) return
    if (event.type === 'pointerup') {
      const pressed = middlePressed
      middlePressed = null
      if (mouse.button !== 1 || pressed !== link) return
      middleActivated = link
    }
    if (event.type === 'auxclick') {
      if (mouse.button !== 1) return
      if (middleActivated === link) {
        middleActivated = null
        event.preventDefault()
        event.stopImmediatePropagation()
        return
      }
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    activate(resolve(link), link)
  }
  for (const name of names) root.addEventListener(name, handle, true)
  return () => {
    middlePressed = middleActivated = null
    for (const name of names) root.removeEventListener(name, handle, true)
  }
}
/** Runs only inside the explicit confirmation gesture. */
export function openConfirmedLink(value: string): boolean {
  const link = externalLink(value)
  if (link.kind !== 'external') return false
  let tab: Window | null = null
  try {
    tab = window.open('', '_blank')
    if (!tab) return false
    tab.opener = null
    const anchor = tab.document.createElement('a')
    anchor.href = link.url
    anchor.rel = 'noopener noreferrer'
    anchor.referrerPolicy = 'no-referrer'
    tab.document.body.append(anchor)
    anchor.click()
    return true
  } catch {
    tab?.close()
    return false
  }
}
