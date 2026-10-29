import { generate, walk, type CssNode } from 'css-tree'

export const EPUB_NAMESPACE = 'http://www.idpf.org/2007/ops'
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace'
const namespaces = new Set([
  EPUB_NAMESPACE,
  XML_NAMESPACE,
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/2000/svg',
])
const semanticAttributes = new Map([
  [`${EPUB_NAMESPACE}|type`, 'data-reader-epub-type'],
  [`${XML_NAMESPACE}|lang`, 'data-reader-xml-lang'],
])
const bounded = (value: string | null): value is string =>
  !!value &&
  value.length <= 1000 &&
  Array.from(value).every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)

/** Application-owned mirrors keep selectors working in both XHTML and HTML srcdoc. */
export function copyBookSemantics(from: Element, to: Element) {
  const type = from.getAttributeNS(EPUB_NAMESPACE, 'type')
  if (bounded(type)) {
    to.setAttributeNS(EPUB_NAMESPACE, 'epub:type', type)
    to.setAttribute('data-reader-epub-type', type)
  }
  const xmlLang = from.getAttributeNS(XML_NAMESPACE, 'lang')
  if (bounded(xmlLang)) {
    to.setAttributeNS(XML_NAMESPACE, 'xml:lang', xmlLang)
    to.setAttribute('data-reader-xml-lang', xmlLang)
  }
  const lang = from.getAttribute('lang') || xmlLang
  if (bounded(lang)) to.setAttribute('lang', lang)
}

/** Namespace URIs are identifiers, never requests. Keep only known publication namespaces. */
export function bookNamespaceContext(ast: CssNode) {
  const aliases = new Map<string, string>()
  const declarations: string[] = []
  let unsupportedDefault = false
  ast.children?.forEach((node) => {
    if (node.type !== 'Atrule' || node.name?.toLowerCase() !== 'namespace' || !node.prelude) return
    let prefix = '',
      uri = '',
      valid = true,
      count = 0
    node.prelude.children?.forEach((part) => {
      count++
      if (
        part.type === 'Identifier' &&
        !prefix &&
        !uri &&
        /^[a-zA-Z_][\w-]{0,63}$/u.test(part.name ?? '')
      )
        prefix = part.name!
      else if (
        (part.type === 'String' || part.type === 'Url') &&
        !uri &&
        typeof part.value === 'string'
      )
        uri = part.value
      else valid = false
    })
    if (!valid || !uri || count > 2) return
    if (!namespaces.has(uri)) {
      aliases.delete(prefix)
      if (!prefix) unsupportedDefault = true
      return
    }
    if (!prefix) unsupportedDefault = false
    aliases.set(prefix, uri)
    declarations.push(generate(node))
  })
  return { aliases, declarations, unsupportedDefault }
}

/** Rewrite semantic attributes so matching does not depend on iframe XML parsing. */
export function normalizeBookSelector(
  prelude: CssNode,
  aliases: ReadonlyMap<string, string>,
): boolean {
  let safe = true
  walk(prelude, (node) => {
    if (node.type === 'Raw') safe = false
    if (node.type === 'AttributeSelector') {
      const identifier = (node as unknown as { name: { name?: string } }).name
      const name = identifier?.name ?? '',
        split = name.indexOf('|')
      if (split < 0) return
      const prefix = name.slice(0, split),
        local = name.slice(split + 1)
      if (!prefix || prefix === '*') return
      const uri = aliases.get(prefix),
        replacement = uri && semanticAttributes.get(`${uri}|${local}`)
      if (replacement) identifier.name = replacement
      else safe = false
    }
    if (node.type === 'TypeSelector' && node.name?.includes('|')) {
      const prefix = node.name.slice(0, node.name.indexOf('|'))
      if (prefix && prefix !== '*' && !aliases.has(prefix)) safe = false
    }
  })
  return safe
}
