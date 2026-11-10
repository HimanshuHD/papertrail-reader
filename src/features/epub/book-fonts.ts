/** Container admission bounds, not a replacement for the browser's font decoder. */
export const EPUB_FONT_LIMITS = Object.freeze({
  inputBytes: 4 * 1024 * 1024,
  expandedBytes: 16 * 1024 * 1024,
  chapterBytes: 16 * 1024 * 1024,
  faces: 16,
  attempts: 32,
  workBytes: 32 * 1024 * 1024,
  tables: 128,
})
export class EpubFontError extends Error {}
export function verifyBookFont(bytes: Uint8Array): string {
  const fail = (): never => {
    throw new EpubFontError('Embedded font is malformed, unsupported or exceeds its limits.')
  }
  if (bytes.length < 12 || bytes.length > EPUB_FONT_LIMITS.inputBytes) return fail()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const signature = String.fromCharCode(...bytes.subarray(0, 4))
  const range = (offset: number, length: number, start: number) =>
    offset >= start && length > 0 && offset + length <= bytes.length
  if (signature === 'wOF2') {
    if (
      bytes.length < 48 ||
      view.getUint32(8) !== bytes.length ||
      view.getUint16(14) !== 0 ||
      ![0x00010000, 0x4f54544f].includes(view.getUint32(4)) ||
      !view.getUint16(12) ||
      view.getUint16(12) > EPUB_FONT_LIMITS.tables ||
      view.getUint32(16) < 12 ||
      view.getUint32(16) > EPUB_FONT_LIMITS.expandedBytes ||
      !range(48, view.getUint32(20), 48)
    )
      return fail()
    // Variable directory/compression validity is checked by the browser decoder.
    for (const [offset, size] of [
      [28, 32],
      [40, 44],
    ])
      if (
        (view.getUint32(offset!) === 0) !== (view.getUint32(size!) === 0) ||
        (view.getUint32(offset!) && !range(view.getUint32(offset!), view.getUint32(size!), 48))
      )
        return fail()
    if (
      view.getUint32(36) > EPUB_FONT_LIMITS.expandedBytes ||
      (view.getUint32(28) === 0) !== (view.getUint32(36) === 0)
    )
      return fail()
    return 'font/woff2'
  }
  const woff = signature === 'wOFF'
  if (!woff && signature !== 'OTTO' && view.getUint32(0) !== 0x00010000) return fail()
  if (
    woff &&
    (bytes.length < 44 ||
      view.getUint32(8) !== bytes.length ||
      view.getUint16(14) !== 0 ||
      ![0x00010000, 0x4f54544f].includes(view.getUint32(4)))
  )
    return fail()
  const count = view.getUint16(woff ? 12 : 4),
    start = woff ? 44 : 12,
    stride = woff ? 20 : 16
  if (!count || count > EPUB_FONT_LIMITS.tables || start + count * stride > bytes.length)
    return fail()
  const end = start + count * stride,
    tags = new Set<number>(),
    ranges: [number, number][] = []
  let expanded = 12 + count * 16
  for (let i = 0; i < count; i++) {
    const pos = start + i * stride,
      tag = view.getUint32(pos),
      offset = view.getUint32(pos + (woff ? 4 : 8))
    const size = view.getUint32(pos + (woff ? 8 : 12)),
      original = woff ? view.getUint32(pos + 12) : size
    if (
      tags.has(tag) ||
      !range(offset, size, end) ||
      offset % 4 ||
      original < size ||
      original > EPUB_FONT_LIMITS.expandedBytes ||
      ranges.some(([a, b]) => offset < b && offset + size > a)
    )
      return fail()
    tags.add(tag)
    ranges.push([offset, offset + size])
    expanded += Math.ceil(original / 4) * 4
    if (expanded > EPUB_FONT_LIMITS.expandedBytes) return fail()
  }
  if (woff && view.getUint32(16) !== expanded) return fail()
  if (woff) {
    for (const [offset, size] of [
      [24, 28],
      [36, 40],
    ])
      if (
        (view.getUint32(offset!) === 0) !== (view.getUint32(size!) === 0) ||
        (view.getUint32(offset!) &&
          (!range(view.getUint32(offset!), view.getUint32(size!), end) ||
            ranges.some(
              ([a, b]) =>
                view.getUint32(offset!) < b && view.getUint32(offset!) + view.getUint32(size!) > a,
            )))
      )
        return fail()
    if (
      view.getUint32(32) > EPUB_FONT_LIMITS.expandedBytes ||
      (view.getUint32(24) === 0) !== (view.getUint32(32) === 0)
    )
      return fail()
  }
  return woff ? 'font/woff' : signature === 'OTTO' ? 'font/otf' : 'font/ttf'
}

/** Share verified font URLs across retained chapters; release on the last owner. */
export class BookFontPool {
  private entries = new Map<string, { url: string; bytes: number; references: number }>()
  acquire(path: string) {
    const entry = this.entries.get(path)
    if (!entry) return undefined
    entry.references++
    return entry
  }
  add(path: string, bytes: Uint8Array, mime: string) {
    const existing = this.acquire(path)
    if (existing) return existing
    const entry = {
      url: URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime })),
      bytes: bytes.byteLength,
      references: 1,
    }
    this.entries.set(path, entry)
    return entry
  }
  release(url: string): boolean {
    for (const [path, entry] of this.entries) {
      if (entry.url !== url) continue
      if (--entry.references === 0) {
        this.entries.delete(path)
        URL.revokeObjectURL(url)
      }
      return true
    }
    return false
  }
}
