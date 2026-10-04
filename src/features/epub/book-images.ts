const SVG = 'http://www.w3.org/2000/svg'
const tags = new Set(
  'svg g defs path rect circle ellipse line polyline polygon text tspan linearGradient radialGradient stop clipPath mask use title desc'.split(
    ' ',
  ),
)
const attrs = new Set(
  'id viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points transform fill stroke stroke-width opacity fill-opacity stroke-opacity fill-rule clip-rule preserveAspectRatio offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod font-family font-size text-anchor'.split(
    ' ',
  ),
)
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
    throw new Error('EPUB image dimensions exceed their budget.')
}

/** Validate raster headers or rebuild standalone SVG without active/remote resources. */
export function verifyBookImage(bytes: Uint8Array, mime: string): Uint8Array | null {
  if (mime === 'image/svg+xml') {
    if (bytes.length > 1024 * 1024) throw new Error('EPUB vector image is too large.')
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
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
    function copy(from: Element, to: Element, depth: number) {
      if (++count > 20000 || depth > 64) throw new Error('EPUB vector image is too complex.')
      for (const attr of from.attributes) {
        if (
          attrs.has(attr.name) &&
          attr.value.length < 65536 &&
          !/[:\\]/u.test(attr.value) &&
          (!/url\s*\(/iu.test(attr.value) || /^url\(#[\w-]+\)$/u.test(attr.value))
        )
          to.setAttribute(attr.name, attr.value)
        if ((attr.name === 'href' || attr.name === 'xlink:href') && /^#[\w-]+$/u.test(attr.value))
          to.setAttribute('href', attr.value)
      }
      for (const child of from.childNodes) {
        if (child.nodeType === Node.TEXT_NODE)
          to.append(output.createTextNode(child.textContent ?? ''))
        if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child as Element
          if (element.namespaceURI !== SVG || !tags.has(element.localName)) continue
          const fresh = output.createElementNS(SVG, element.localName)
          to.append(fresh)
          copy(element, fresh, depth + 1)
        }
      }
    }
    copy(source.documentElement, output.documentElement, 0)
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
