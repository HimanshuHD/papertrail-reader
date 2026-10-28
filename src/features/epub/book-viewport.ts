import { parse, walk, type CssNode } from 'css-tree'

const axes: Record<string, string> = {
  vh: 'height',
  vw: 'width',
  vmin: 'min',
  vmax: 'max',
  svh: 'height',
  lvh: 'height',
  dvh: 'height',
  svw: 'width',
  lvw: 'width',
  dvw: 'width',
  svmin: 'min',
  lvmin: 'min',
  dvmin: 'min',
  svmax: 'max',
  lvmax: 'max',
  dvmax: 'max',
}

/** Author lengths must use the reading viewport, not the full-chapter iframe. */
export function bindBookViewportLengths(value: CssNode) {
  walk(value, (node) => {
    const axis = node.type === 'Dimension' && axes[node.unit?.toLowerCase() ?? '']
    if (!axis || typeof node.value !== 'string') return
    const replacement = parse(`calc(${node.value} * var(--papertrail-reader-${axis}))`, {
      context: 'value',
    })
    replacement.children?.forEach((length) => Object.assign(node, length))
  })
}

export function applyBookViewport(doc: Document, width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
  for (const [axis, length] of Object.entries({
    width,
    height,
    min: Math.min(width, height),
    max: Math.max(width, height),
  }))
    doc.documentElement.style.setProperty(`--papertrail-reader-${axis}`, `${length / 100}px`)
}
