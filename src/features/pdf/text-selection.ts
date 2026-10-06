/* Copyright 2014 Mozilla Foundation
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * Adapted from Mozilla PDF.js TextLayerBuilder.
 * https://github.com/mozilla/pdf.js/blob/master/web/text_layer_builder.js
 * Low-level TextLayer rendering does not install this native selection guard.
 */
import { pdfCaretAt, type PdfCaret } from './selection-caret'

type SelectionGuard = { add: (layer: HTMLElement) => () => void }
const guards = new WeakMap<Document, SelectionGuard>()

export function bindPdfTextSelection(layer: HTMLElement): () => void {
  const doc = layer.ownerDocument
  let guard = guards.get(doc)
  if (!guard) {
    guard = createGuard(doc)
    guards.set(doc, guard)
  }
  return guard.add(layer)
}

function createGuard(doc: Document): SelectionGuard {
  const layers = new Map<HTMLElement, HTMLElement>()
  const win = doc.defaultView!
  let previous: Range | undefined
  let pointerDown = false
  let moveFrame = 0
  let pendingMove: PointerEvent | undefined
  let drag: { anchor: PdfCaret; layer: HTMLElement; pointerId: number } | undefined
  const dragLayers = () =>
    [...layers.keys()].filter(
      (layer) => layer.closest('.pdf-reader') === drag?.layer.closest('.pdf-reader'),
    )
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId || !drag.anchor.node.isConnected) return
    const focus = pdfCaretAt(dragLayers(), event.clientX, event.clientY)
    if (!focus) return
    event.preventDefault()
    doc
      .getSelection()
      ?.setBaseAndExtent(drag.anchor.node, drag.anchor.offset, focus.node, focus.offset)
  }
  const queueMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    event.preventDefault()
    pendingMove = event
    if (moveFrame) return
    moveFrame = win.requestAnimationFrame(() => {
      moveFrame = 0
      if (pendingMove) move(pendingMove)
      pendingMove = undefined
    })
  }
  const mouseStart = (event: MouseEvent) => {
    if (!drag) return
    // Keep native double/triple click word/paragraph selection.
    if (event.detail > 1) {
      drag = undefined
      return
    }
    event.preventDefault()
  }
  const reset = (layer: HTMLElement, end: HTMLElement) => {
    layer.append(end)
    end.style.width = ''
    end.style.height = ''
    end.style.userSelect = ''
    layer.classList.remove('selecting')
  }
  const resetAll = () => {
    win.cancelAnimationFrame(moveFrame)
    moveFrame = 0
    pendingMove = undefined
    pointerDown = false
    drag = undefined
    previous = undefined
    layers.forEach((end, layer) => reset(layer, end))
  }
  const start = (event: PointerEvent) => {
    pointerDown = true
    previous = undefined
    const target = event.target
    const layer = [...layers.keys()].find(
      (layer) => target instanceof win.Node && layer.contains(target),
    )
    if (
      layer &&
      event.pointerType === 'mouse' &&
      event.button === 0 &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const anchor = pdfCaretAt([layer], event.clientX, event.clientY)
      if (anchor) {
        drag = { anchor, layer, pointerId: event.pointerId }
        doc.getSelection()?.setBaseAndExtent(anchor.node, anchor.offset, anchor.node, anchor.offset)
      }
    }
    layers.forEach((_, layer) => {
      if (target instanceof win.Node && layer.contains(target)) layer.classList.add('selecting')
    })
  }
  const keyup = () => {
    if (!pointerDown) resetAll()
  }
  const change = () => {
    const selection = doc.getSelection()
    if (!selection?.rangeCount || selection.isCollapsed) {
      if (drag) return
      resetAll()
      return
    }
    layers.forEach((end, layer) => {
      const active = Array.from({ length: selection.rangeCount }, (_, i) =>
        selection.getRangeAt(i),
      ).some((range) => range.intersectsNode(layer))
      if (active) layer.classList.add('selecting')
      else reset(layer, end)
    })
    if (drag) return
    // Chromium 148+ and Firefox handle the non-selectable guard natively.
    const sample = layers.values().next().value
    const chrome = /\bChrome\/(\d+)\b/.exec(win.navigator.userAgent)?.[1]
    if (
      !sample ||
      win.getComputedStyle(sample).getPropertyValue('-moz-user-select') === 'none' ||
      (chrome && Number(chrome) >= 148)
    )
      return
    // Older engines need the guard beside the moving range boundary so blank
    // space cannot resolve to an unrelated end-of-page DOM position.
    const range = selection.getRangeAt(0)
    const movingStart =
      !!previous &&
      (range.compareBoundaryPoints(Range.END_TO_END, previous) === 0 ||
        range.compareBoundaryPoints(Range.START_TO_END, previous) === 0)
    let anchor: Node | null = movingStart ? range.startContainer : range.endContainer
    if (anchor.nodeType === Node.TEXT_NODE) anchor = anchor.parentNode
    if (!movingStart && range.endOffset === 0) {
      while (anchor && !anchor.previousSibling) anchor = anchor.parentNode
      anchor = anchor?.previousSibling ?? null
    }
    const parent = anchor?.parentElement
    const layer = parent?.closest<HTMLElement>('.textLayer')
    const end = layer && layers.get(layer)
    if (end && parent && anchor && anchor !== end && layer.contains(anchor)) {
      end.style.width = layer.style.width
      end.style.height = layer.style.height
      end.style.userSelect = 'text'
      parent.insertBefore(end, movingStart ? anchor : anchor.nextSibling)
    }
    previous = range.cloneRange()
  }
  doc.addEventListener('pointerdown', start)
  doc.addEventListener('mousedown', mouseStart)
  doc.addEventListener('pointermove', queueMove, { passive: false })
  const finish = (event: PointerEvent) => {
    if (drag && event.pointerId !== drag.pointerId) return
    if (!event.defaultPrevented) move(event)
    resetAll()
  }
  doc.addEventListener('pointerup', finish)
  doc.addEventListener('pointercancel', resetAll)
  doc.addEventListener('keyup', keyup)
  doc.addEventListener('selectionchange', change)
  win.addEventListener('blur', resetAll)
  return {
    add(layer) {
      const end = doc.createElement('div')
      end.className = 'endOfContent'
      end.setAttribute('aria-hidden', 'true')
      layers.set(layer, end)
      layer.append(end)
      return () => {
        if (drag?.layer === layer) drag = undefined
        end.remove()
        layer.classList.remove('selecting')
        layers.delete(layer)
        if (layers.size) return
        resetAll()
        doc.removeEventListener('pointerdown', start)
        doc.removeEventListener('mousedown', mouseStart)
        doc.removeEventListener('pointermove', queueMove)
        doc.removeEventListener('pointerup', finish)
        doc.removeEventListener('pointercancel', resetAll)
        doc.removeEventListener('keyup', keyup)
        doc.removeEventListener('selectionchange', change)
        win.removeEventListener('blur', resetAll)
        guards.delete(doc)
      }
    },
  }
}
