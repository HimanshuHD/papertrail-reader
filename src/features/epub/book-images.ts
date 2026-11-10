import { parse, generate, walk, type CssNode } from 'css-tree'

const SVG = 'http://www.w3.org/2000/svg'
export const EPUB_SVG_BYTE_LIMIT = 4 * 1024 * 1024
export class EpubImageLimitError extends Error {}
const tags = new Set(
  'svg g defs symbol style path rect circle ellipse line polyline polygon text tspan textPath linearGradient radialGradient stop clipPath mask use title desc'.split(
    ' ',
  ),
)
const attrs = new Set(
  'id class viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points transform fill stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity fill-opacity stroke-opacity fill-rule clip-rule clip-path mask preserveAspectRatio offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod font-family font-size font-style font-weight text-anchor vector-effect color'.split(
    ' ',
  ),
)
const svgProperties = new Set(
  'fill stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity fill-opacity stroke-opacity fill-rule clip-rule clip-path mask stop-color stop-opacity font-family font-size font-style font-weight text-anchor vector-effect color display visibility'.split(
    ' ',
  ),
)
function svgStyle(css: string, inline = false): string {
  let ast: CssNode
  try {
    ast = parse(css, { context: inline ? 'declarationList' : 'stylesheet' })
  } catch {
    throw new EpubImageLimitError('SVG stylesheet is malformed.')
  }
  let count = 0
  walk(ast, () => {
    if (++count > 20000)
      throw new EpubImageLimitError('SVG stylesheet exceeds its complexity limit.')
  })
  function declarations(block: CssNode): string {
    const result: string[] = []
    block.children?.forEach((node) => {
      if (
        node.type !== 'Declaration' ||
        !node.property ||
        typeof node.value !== 'object' ||
        (!svgProperties.has(node.property.toLowerCase()) && !node.property.startsWith('--'))
      )
        return
      let safe = true
      walk(node.value, (value) => {
        if (
          value.type === 'Raw' ||
          (value.type === 'Url' &&
            (typeof value.value !== 'string' || !/^#[\w.-]+$/u.test(value.value)))
        )
          safe = false
        if (
          value.type === 'Function' &&
          !['rgb', 'rgba', 'hsl', 'hsla', 'calc', 'min', 'max', 'clamp', 'var'].includes(
            value.name?.toLowerCase() ?? '',
          )
        )
          safe = false
      })
      if (safe) result.push(generate(node))
    })
    return result.join(';')
  }
  if (inline) return declarations(ast)
  const rules: string[] = []
  ast.children?.forEach((node) => {
    if (node.type !== 'Rule' || !node.prelude || !node.block) return
    let safe = true
    walk(node.prelude, (selector) => {
      if (selector.type === 'Raw') safe = false
    })
    const content = declarations(node.block)
    if (safe && content) rules.push(`${generate(node.prelude)}{${content}}`)
  })
  return rules.join('\n')
}
function dimensions(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 32 * 1024 * 1024
  )
    throw new EpubImageLimitError('EPUB image dimensions exceed their budget.')
}

/** Validate raster headers or rebuild standalone SVG without active/remote resources. */
export function verifyBookImage(bytes: Uint8Array, mime: string): Uint8Array | null {
  if (mime === 'image/svg+xml') {
    if (bytes.length > EPUB_SVG_BYTE_LIMIT)
      throw new EpubImageLimitError('SVG illustration exceeds the 4 MiB size limit.')
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      return null
    }
    if (/<!DOCTYPE|<!ENTITY/iu.test(text)) return null
    const source = new DOMParser().parseFromString(text, 'application/xml')
    if (
      source.querySelector('parsererror') ||
      source.documentElement.namespaceURI !== SVG ||
      source.documentElement.localName !== 'svg'
    )
      return null
    const output = document.implementation.createDocument(SVG, 'svg')
    let count = 0
    let geometryNumbers = 0
    let geometryCommands = 0
    function geometry(value: string, path: boolean) {
      const tokens = /[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/gu
      let end = 0
      for (const token of value.matchAll(tokens)) {
        if (!/^[\s,]*$/u.test(value.slice(end, token.index)))
          throw new EpubImageLimitError('SVG illustration contains unsupported geometry.')
        if (/^[A-Za-z]$/u.test(token[0])) {
          if (!path || !/^[AaCcHhLlMmQqSsTtVvZz]$/u.test(token[0]))
            throw new EpubImageLimitError('SVG illustration contains unsupported geometry.')
          geometryCommands++
        } else {
          const number = Number(token[0])
          if (!Number.isFinite(number) || Math.abs(number) > 1e9)
            throw new EpubImageLimitError('SVG illustration coordinates exceed their limit.')
          geometryNumbers++
        }
        if (geometryNumbers > 1000000 || geometryCommands > 100000)
          throw new EpubImageLimitError('SVG illustration exceeds the geometry-work limit.')
        end = token.index + token[0].length
      }
      if (!/^[\s,]*$/u.test(value.slice(end)))
        throw new EpubImageLimitError('SVG illustration contains unsupported geometry.')
    }
    function copy(from: Element, to: Element, depth: number) {
      if (++count > 20000 || depth > 64)
        throw new EpubImageLimitError('SVG illustration exceeds the structure or nesting limit.')
      for (const attr of from.attributes) {
        if (attr.name === 'style') {
          to.setAttribute('style', svgStyle(attr.value, true))
          continue
        }
        if (attr.name === 'd' || attr.name === 'points') geometry(attr.value, attr.name === 'd')
        if (
          attrs.has(attr.name) &&
          !/[:\\]/u.test(attr.value) &&
          (!/url\s*\(/iu.test(attr.value) || /^url\(#[\w.-]+\)$/u.test(attr.value))
        )
          to.setAttribute(attr.name, attr.value)
        if ((attr.name === 'href' || attr.name === 'xlink:href') && /^#[\w.-]+$/u.test(attr.value))
          to.setAttribute('href', attr.value)
      }
      if (from.localName === 'style') {
        to.textContent = svgStyle(from.textContent ?? '')
        return
      }
      for (const child of from.childNodes) {
        if (child.nodeType === Node.TEXT_NODE)
          to.append(output.createTextNode(child.textContent ?? ''))
        if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child as Element
          if (
            (element.namespaceURI === SVG && element.localName === 'metadata') ||
            (element.namespaceURI === 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd' &&
              element.localName === 'namedview')
          )
            continue
          if (element.namespaceURI !== SVG || !tags.has(element.localName))
            throw new EpubImageLimitError('SVG illustration uses an unsupported drawing feature.')
          const fresh = output.createElementNS(SVG, element.localName)
          to.append(fresh)
          copy(element, fresh, depth + 1)
        }
      }
    }
    copy(source.documentElement, output.documentElement, 0)
    // Bound referenced expansion as well as the source tree: a small graph of
    // repeated <use> elements can otherwise expand exponentially or recurse.
    const ids = new Map<string, Element>()
    for (const element of output.querySelectorAll('*')) {
      const id = element.getAttribute('id')
      if (!id) continue
      if (ids.has(id)) throw new EpubImageLimitError('SVG illustration has ambiguous references.')
      ids.set(id, element)
    }
    const costs = new Map<Element, number>()
    function expansion(element: Element, ancestors: Set<Element>, depth: number): number {
      if (depth > 64 || ancestors.has(element))
        throw new EpubImageLimitError('SVG illustration has recursive references.')
      if (costs.has(element)) return costs.get(element)!
      const next = new Set(ancestors).add(element)
      let cost = 1
      const references = new Set<string>()
      for (const attr of element.attributes) {
        if (attr.name === 'href' && attr.value.startsWith('#')) references.add(attr.value.slice(1))
        for (const match of attr.value.matchAll(/url\(\s*["']?#([\w.-]+)/gu))
          references.add(match[1]!)
      }
      for (const child of element.children) cost += expansion(child, next, depth + 1)
      for (const id of references) {
        const referenced = ids.get(id)
        if (referenced) cost += expansion(referenced, next, depth + 1)
      }
      if (cost > 100000)
        throw new EpubImageLimitError('SVG illustration exceeds the reference-work limit.')
      costs.set(element, cost)
      return cost
    }
    expansion(output.documentElement, new Set(), 0)
    dimensions(
      parseFloat(output.documentElement.getAttribute('width') ?? '300') || 300,
      parseFloat(output.documentElement.getAttribute('height') ?? '150') || 150,
    )
    return new TextEncoder().encode(new XMLSerializer().serializeToString(output))
  }
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (
    mime === 'image/png' &&
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
  )
    dimensions(data.getUint32(16), data.getUint32(20))
  else if (
    mime === 'image/gif' &&
    bytes.length >= 10 &&
    /^GIF8[79]a/u.test(new TextDecoder().decode(bytes.subarray(0, 6)))
  )
    dimensions(data.getUint16(6, true), data.getUint16(8, true))
  else if (mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216) {
    let found = false
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 255) return null
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]!
      if (marker === 217 || marker === 218) break
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue
      const length = data.getUint16(offset)
      if (length < 2 || offset + length > bytes.length) return null
      if (marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)) {
        dimensions(data.getUint16(offset + 5), data.getUint16(offset + 3))
        found = true
        break
      }
      offset += length
    }
    if (!found) return null
  } else if (
    mime === 'image/webp' &&
    bytes.length >= 30 &&
    new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP'
  ) {
    const kind = new TextDecoder().decode(bytes.subarray(12, 16))
    if (kind === 'VP8X')
      dimensions(
        1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16),
        1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16),
      )
    else if (kind === 'VP8 ')
      dimensions(data.getUint16(26, true) & 16383, data.getUint16(28, true) & 16383)
    else if (kind === 'VP8L' && bytes[20] === 47) {
      const bits = data.getUint32(21, true)
      dimensions((bits & 16383) + 1, ((bits >>> 14) & 16383) + 1)
    } else return null
  } else return null
  return bytes
}
