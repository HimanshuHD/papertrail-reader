export interface EpubNoteRange {
  id: string
  note: string
  range: Pick<Range, 'getClientRects'>
}
interface Rectangle {
  top: number
  bottom: number
  note: number
  order: number
}

/** Chapter-local document coordinates only: never retain DOM nodes or Ranges. */
export class EpubNoteGeometry {
  private rectangles: Rectangle[] | undefined
  private notes: { id: string; note: string }[] = []
  private bottoms = new Float64Array(0)

  invalidate() {
    this.rectangles = undefined
    this.notes = []
    this.bottoms = new Float64Array(0)
  }

  visible(
    read: () => EpubNoteRange[],
    scrollY: number,
    top: number,
    bottom: number,
    fresh = false,
  ) {
    if (fresh) {
      this.invalidate()
      return read().flatMap(({ id, note, range }) => {
        const rect = Array.from(range.getClientRects()).find(
          (rect) =>
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom + scrollY > top &&
            rect.top + scrollY < bottom,
        )
        return rect ? [{ id, note, top: rect.top }] : []
      })
    }
    if (!this.rectangles) {
      const rectangles: Rectangle[] = []
      this.notes = read().map(({ id, note, range }, index) => {
        Array.from(range.getClientRects()).forEach((rect, order) => {
          if (rect.width > 0 && rect.height > 0)
            rectangles.push({
              top: rect.top + scrollY,
              bottom: rect.bottom + scrollY,
              note: index,
              order,
            })
        })
        return { id, note }
      })
      rectangles.sort((a, b) => a.top - b.top)
      this.bottoms = new Float64Array(rectangles.length)
      let maximum = -Infinity
      rectangles.forEach((rect, i) => {
        maximum = Math.max(maximum, rect.bottom)
        this.bottoms[i] = maximum
      })
      this.rectangles = rectangles
    }
    let low = 0,
      high = this.rectangles.length
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (this.bottoms[middle]! <= top) low = middle + 1
      else high = middle
    }
    const matches = new Map<number, Rectangle>()
    for (let i = low; i < this.rectangles.length; i++) {
      const rect = this.rectangles[i]!
      if (rect.top >= bottom) break
      if (rect.bottom <= top) continue
      const previous = matches.get(rect.note)
      // Preserve getClientRects() order even for non-monotonic columns/RTL.
      if (!previous || rect.order < previous.order) matches.set(rect.note, rect)
    }
    return [...matches]
      .sort(([a], [b]) => a - b)
      .map(([index, rect]) => ({ ...this.notes[index]!, top: rect.top - scrollY }))
  }
}

function ownHighlightStyle(node: Node) {
  const element = node.nodeType === 1 ? (node as Element) : node.parentElement
  return !!element?.closest('style[data-papertrail-highlights]')
}

/** Size changes are additionally owned by the workspace's existing ResizeObserver. */
export function observeEpubNoteLayout(doc: Document, invalidated: () => void) {
  let disposed = false
  const update = () => {
    if (!disposed) invalidated()
  }
  const observer = new MutationObserver((records) => {
    if (disposed) return
    if (
      records.some(
        (record) =>
          !ownHighlightStyle(record.target) &&
          !(
            record.type === 'childList' &&
            [...record.addedNodes, ...record.removedNodes].length > 0 &&
            [...record.addedNodes, ...record.removedNodes].every(ownHighlightStyle)
          ),
      )
    )
      update()
  })
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'hidden', 'dir', 'width', 'height'],
  })
  const releases: (() => void)[] = []
  const listen = (target: EventTarget | undefined | null, name: string) => {
    if (!target) return
    target.addEventListener(name, update, true)
    releases.push(() => target.removeEventListener(name, update, true))
  }
  for (const name of [
    'scroll',
    'load',
    'error',
    'pointerover',
    'pointerout',
    'pointerdown',
    'pointerup',
    'focusin',
    'focusout',
    'keydown',
    'keyup',
  ])
    listen(doc, name)
  for (const name of ['scroll', 'resize']) listen(doc.defaultView, name)
  for (const name of ['loadingdone', 'loadingerror']) listen(doc.fonts, name)
  return {
    listenerCount: releases.length,
    dispose() {
      if (disposed) return
      disposed = true
      observer.disconnect()
      releases.splice(0).forEach((release) => release())
    },
  }
}
