export type PdfCaret = { node: Text; offset: number }
function distance(value: number, low: number, high: number) {
  return Math.max(low - value, 0, value - high)
}
/** Resolve blank-space coordinates to a real text boundary, never a guard node. */
export function pdfCaretAt(layers: HTMLElement[], x: number, y: number): PdfCaret | undefined {
  const page = layers
    .map((layer) => {
      const box = layer.getBoundingClientRect()
      return {
        layer,
        score: distance(x, box.left, box.right) ** 2 + distance(y, box.top, box.bottom) ** 2,
      }
    })
    .sort((a, b) => a.score - b.score)[0]?.layer
  if (!page) return
  const rotation = Number(page.dataset.mainRotation ?? 0)
  const vertical = rotation === 90 || rotation === 270
  const walker = page.ownerDocument.createTreeWalker(page, NodeFilter.SHOW_TEXT)
  let best: { node: Text; line: number; inline: number } | undefined
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!node.data.trim() || node.parentElement?.closest('.endOfContent')) continue
    const range = page.ownerDocument.createRange()
    range.selectNodeContents(node)
    for (const box of range.getClientRects()) {
      if (!box.width || !box.height) continue
      const dx = distance(x, box.left, box.right),
        dy = distance(y, box.top, box.bottom)
      const line = vertical ? dx : dy,
        inline = vertical ? dy : dx
      if (!best || line < best.line || (line === best.line && inline < best.inline))
        best = { node, line, inline }
    }
  }
  if (!best) return
  const node = best.node
  const rtl =
    page.ownerDocument.defaultView!.getComputedStyle(node.parentElement!).direction === 'rtl'
  const reverse = (rotation === 180 || rotation === 270) !== rtl
  let nearest: PdfCaret | undefined,
    score = Infinity
  let offset = 0
  for (const character of node.data) {
    const range = page.ownerDocument.createRange()
    range.setStart(node, offset)
    range.setEnd(node, offset + character.length)
    for (const box of range.getClientRects()) {
      if (!box.width || !box.height) continue
      const value = vertical ? y : x
      const low = vertical ? box.top : box.left,
        high = vertical ? box.bottom : box.right
      for (const [edge, boundary] of [
        [reverse ? high : low, offset],
        [reverse ? low : high, offset + character.length],
      ]) {
        const next = Math.abs(value - edge!)
        if (next < score) {
          score = next
          nearest = { node, offset: boundary! }
        }
      }
    }
    offset += character.length
  }
  return nearest
}
