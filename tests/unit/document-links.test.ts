import { afterEach, expect, it, vi } from 'vitest'
import {
  bindDocumentLinks,
  epubContentLink,
  externalLink,
  inertLinkValue,
  openConfirmedLink,
} from '../../src/features/reader/document-links'
afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})
it('only admits canonical HTTP(S) URLs, rejecting credentials, unsafe schemes and control characters', () => {
  expect(externalLink('https://example.com/a?q=1#two')).toEqual({
    kind: 'external',
    url: 'https://example.com/a?q=1#two',
  })
  expect(externalLink('//example.com')).toMatchObject({
    kind: 'external',
    url: 'https://example.com/',
  })
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///a',
    'mailto:a@example.com',
    'https://user:pass@example.com',
    'https://example.com\n',
    'https:\\example.com',
    'x'.repeat(4097),
  ]) {
    expect(externalLink(value).kind).toBe('blocked')
    expect(inertLinkValue(value)).toBe('!unsupported')
  }
})
it('resolves encoded relative chapter/fragment targets and rejects missing targets or traversal', () => {
  const targets = new Map([
    ['OPS/one.xhtml', { chapter: 0, fragments: new Set(['note 1']) }],
    ['OPS/text/two.xhtml', { chapter: 1, fragments: new Set(['return']) }],
  ])
  expect(epubContentLink('OPS/text/two.xhtml', '../one.xhtml#note%201', targets)).toEqual({
    kind: 'epub',
    chapter: 0,
    fragment: 'note 1',
  })
  expect(epubContentLink('OPS/text/two.xhtml', '#return', targets)).toEqual({
    kind: 'epub',
    chapter: 1,
    fragment: 'return',
  })
  for (const value of [
    '../../../one.xhtml',
    '../one.xhtml#missing',
    'missing.xhtml',
    '../%2fone.xhtml',
    '%ZZ.xhtml',
    'file:///one.xhtml',
  ])
    expect(epubContentLink('OPS/text/two.xhtml', value, targets).kind).toBe('blocked')
})
it('uses the same inert activation path for mouse/modifiers/middle/keyboard and removes registrations', () => {
  document.body.innerHTML =
    '<a role="link" tabindex="0" data-reader-link="https://example.com"><span>External</span></a>'
  const activate = vi.fn(),
    open = vi.spyOn(window, 'open'),
    anchor = document.querySelector('a')!
  const dispose = bindDocumentLinks(
    document,
    (el) => externalLink(el.dataset.readerLink!),
    activate,
  )
  for (const event of [
    new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }),
    new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }),
  ]) {
    anchor.firstElementChild!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  }
  expect(activate).toHaveBeenCalledTimes(3)
  expect(open).not.toHaveBeenCalled()
  expect(anchor.hasAttribute('href')).toBe(false)
  dispose()
  anchor.click()
  expect(activate).toHaveBeenCalledTimes(3)
})
it('opens only on explicit confirmation with opener/referrer isolation and handles blocked popups', () => {
  const child = document.implementation.createHTMLDocument('Tab')
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const tab = { document: child, opener: window, close: vi.fn() }
  const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
  expect(openConfirmedLink('javascript:alert(1)')).toBe(false)
  expect(open).not.toHaveBeenCalled()
  expect(openConfirmedLink('https://example.com/path')).toBe(true)
  expect(open).toHaveBeenCalledWith('', '_blank')
  expect(tab.opener).toBeNull()
  expect(child.querySelector('a')).toMatchObject({
    href: 'https://example.com/path',
    rel: 'noopener noreferrer',
    referrerPolicy: 'no-referrer',
  })
  expect(click).toHaveBeenCalledOnce()
  open.mockReturnValue(null)
  expect(openConfirmedLink('https://example.com')).toBe(false)
  open.mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(openConfirmedLink('https://example.com')).toBe(false)
})
