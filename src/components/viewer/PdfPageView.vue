<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import NoteIndicator from './NoteIndicator.vue'
import type { Annotation } from '../../services/annotation-storage'
import { resolvePdfAnnotation, projectPdfRectangle } from '../../features/annotations/selectors'
import {
  pdfTextIndex,
  pdfTextRange,
  capturePdfRectangles,
  PDF_HIGHLIGHT_COLORS,
} from '../../features/pdf/highlights'
import { bindPdfTextSelection } from '../../features/pdf/text-selection'
import { textLayerMatchRanges } from '../../features/pdf/search-text'
import {
  resolvePdfScale,
  type PdfDocumentSession,
  type PdfFitMode,
} from '../../features/pdf/pdf-session'

const props = defineProps<{
  session: PdfDocumentSession
  pageNumber: number
  fitMode: PdfFitMode
  zoom: number
  availableWidth: number
  availableHeight: number
  scrollRoot: HTMLElement | null
  searchQuery?: string
  selectedOccurrence?: number | null
  selectionRequest?: number
  annotations?: Annotation[]
  fingerprint?: string | null
  activeHighlight?: string | null
}>()

const emit = defineEmits<{
  visibility: [pageNumber: number, ratio: number]
  rendered: [pageNumber: number, scale: number]
  error: [message: string]
  highlightSelected: [id: string]
  noteSelected: [id: string]
  highlightResolution: [id: string, resolved: boolean, page: number]
}>()

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const textLayer = ref<HTMLElement | null>(null)
const highlightRects = ref<
  {
    left: number
    top: number
    width: number
    height: number
    selected: boolean
    occurrence: number
  }[]
>([])
const savedRects = ref<
  { id: string; color: string; x: number; y: number; width: number; height: number }[]
>([])
const noteIndicators = computed(() =>
  (props.annotations ?? [])
    .filter((item) => item.note.trim())
    .flatMap((item) => {
      const rect = savedRects.value.find((rect) => rect.id === item.id)
      return rect ? [{ id: item.id, note: item.note, top: rect.y }] : []
    }),
)
let savedPointerStart: { x: number; y: number } | null = null
function startSavedPointer(event: PointerEvent) {
  savedPointerStart =
    event.button === 0 && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
      ? { x: event.clientX, y: event.clientY }
      : null
}
function selectSavedHighlight(event: PointerEvent) {
  if (
    !savedPointerStart ||
    Math.hypot(event.clientX - savedPointerStart.x, event.clientY - savedPointerStart.y) > 4
  )
    return
  savedPointerStart = null
  const box = root.value?.querySelector('.pdf-page')?.getBoundingClientRect()
  if (!box) return
  const hit = savedRects.value.find(
    (rect) =>
      event.clientX >= box.left + rect.x * box.width &&
      event.clientX <= box.left + (rect.x + rect.width) * box.width &&
      event.clientY >= box.top + rect.y * box.height &&
      event.clientY <= box.top + (rect.y + rect.height) * box.height,
  )
  if (hit) {
    event.preventDefault()
    textLayer.value?.ownerDocument.getSelection()?.removeAllRanges()
    emit('highlightSelected', hit.id)
  }
}
function updateSavedHighlights() {
  savedRects.value = []
  const layer = textLayer.value
  const page = root.value?.querySelector<HTMLElement>('.pdf-page')
  if (!layer || !page || !rendered.value || rendering.value || !props.fingerprint) return
  const text = pdfTextIndex(layer).text
  const identity = { format: 'PDF' as const, fingerprint: props.fingerprint }
  const rotation = Number(layer.dataset.mainRotation ?? 0) as 0 | 90 | 180 | 270
  for (const annotation of props.annotations ?? []) {
    if (annotation.selector.format !== 'PDF') continue
    const segments = annotation.selector.segments.filter(
      (segment) => segment.page === props.pageNumber,
    )
    if (!segments.length) continue
    const result = resolvePdfAnnotation(
      identity,
      identity,
      { ...annotation.selector, segments },
      new Map([[props.pageNumber, text]]),
    )
    if (result.status !== 'resolved') {
      emit('highlightResolution', annotation.id, false, props.pageNumber)
      continue
    }
    let visible = false
    for (const segment of result.value) {
      // Always measure verified text in the current layer, including rotated glyphs/crop boxes.
      const range = pdfTextRange(layer, segment.start, segment.end)
      if (!range) continue
      for (const rectangle of capturePdfRectangles(range, page, layer)) {
        const rect = projectPdfRectangle(rectangle, rotation)
        savedRects.value.push({
          ...rect,
          id: annotation.id,
          color: PDF_HIGHLIGHT_COLORS[annotation.color],
        })
        visible = true
      }
    }
    emit('highlightResolution', annotation.id, visible, props.pageNumber)
  }
}
watch(
  () => [props.annotations, props.fingerprint],
  () => void nextTick(updateSavedHighlights),
)
let lastScrolledRequest = 0
function updateHighlights() {
  highlightRects.value = []
  const layer = textLayer.value
  const element = root.value
  if (!layer || !element || !rendered.value || rendering.value || !props.searchQuery) return
  const origin = canvas.value?.getBoundingClientRect() ?? layer.getBoundingClientRect()
  const highlights: typeof highlightRects.value = []
  let selectedRect: DOMRect | null = null
  for (const { range, occurrence } of textLayerMatchRanges(layer, props.searchQuery)) {
    if (typeof range.getClientRects !== 'function') continue
    const selected = occurrence === props.selectedOccurrence
    for (const rect of range.getClientRects()) {
      if (rect.width < 0.5 || rect.height < 0.5) continue
      highlights.push({
        left: rect.left - origin.left,
        top: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
        selected,
        occurrence,
      })
      if (selected && !selectedRect) selectedRect = rect
    }
  }
  highlightRects.value = highlights
  const pane = props.scrollRoot
  const request = props.selectionRequest ?? 0
  if (pane && selectedRect && request && request !== lastScrolledRequest) {
    lastScrolledRequest = request
    const bounds = pane.getBoundingClientRect()
    const left =
      selectedRect.left < bounds.left || selectedRect.right > bounds.right
        ? Math.max(0, pane.scrollLeft + selectedRect.left - bounds.left - pane.clientWidth / 3)
        : pane.scrollLeft
    pane.scrollTo?.({
      top: Math.max(0, pane.scrollTop + selectedRect.top - bounds.top - pane.clientHeight / 3),
      left,
      behavior: 'instant',
    })
  }
}
watch(
  () => [props.searchQuery, props.selectedOccurrence, props.selectionRequest],
  () => void nextTick(updateHighlights),
)

const rendered = ref(false)
const previewed = ref(false)
const rendering = ref(false)
const dimensions = ref<{ width: number; height: number } | null>(null)
const layout = computed(() => {
  const size = dimensions.value ??
    props.session.defaultPageDimensions ?? { width: 612, height: 792 }
  const scale = resolvePdfScale(
    props.fitMode,
    props.zoom,
    size.width,
    size.height,
    props.availableWidth,
    props.availableHeight,
  )
  return { width: size.width * scale, height: size.height * scale }
})
let observer: IntersectionObserver | null = null
let visibilityObserver: IntersectionObserver | null = null
let renderSequence = 0
let nearViewport = false
let dirty = true
let disposed = false
let scrollFrame = 0
let measuring = false
let pendingBitmap: HTMLCanvasElement | null = null
let releaseTextSelection: (() => void) | undefined

async function renderPage() {
  if (!nearViewport || rendering.value || !dirty || disposed) return
  if (!dimensions.value) {
    if (measuring) return
    measuring = true
    try {
      dimensions.value = await props.session.getPageDimensions(props.pageNumber)
    } catch (error) {
      if (!disposed)
        emit('error', error instanceof Error ? error.message : 'Unable to measure PDF page.')
      return
    } finally {
      measuring = false
    }
    if (!nearViewport || disposed) return
  }
  const currentCanvas = canvas.value
  const currentTextLayer = textLayer.value
  if (!currentCanvas || !currentTextLayer) return

  const pendingCanvas = document.createElement('canvas')
  const pendingText = document.createElement('div')
  pendingBitmap = pendingCanvas
  const sequence = ++renderSequence
  rendering.value = true
  highlightRects.value = []
  savedRects.value = []
  dirty = false

  try {
    const result = await props.session.render({
      canvas: pendingCanvas,
      textLayer: pendingText,
      pageNumber: props.pageNumber,
      fitMode: props.fitMode,
      zoom: props.zoom,
      availableWidth: props.availableWidth,
      availableHeight: props.availableHeight,
    })
    if (sequence !== renderSequence) return

    const context = currentCanvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Canvas rendering is unavailable in this browser.')
    currentCanvas.width = pendingCanvas.width
    currentCanvas.height = pendingCanvas.height
    context.drawImage(pendingCanvas, 0, 0)
    currentTextLayer.style.cssText = pendingText.style.cssText
    currentTextLayer.dataset.mainRotation = pendingText.dataset.mainRotation ?? '0'
    releaseTextSelection?.()
    currentTextLayer.replaceChildren(...pendingText.childNodes)
    releaseTextSelection = bindPdfTextSelection(currentTextLayer)
    rendered.value = true
    previewed.value = false
    props.session.cachePagePreview?.(props.pageNumber, pendingCanvas)
    emit('rendered', props.pageNumber, result.scale)
  } catch (error) {
    if (sequence !== renderSequence) return
    if (
      error instanceof Error &&
      (error.name === 'RenderingCancelledException' ||
        error.message === 'TextLayer task cancelled.')
    ) {
      return
    }

    emit(
      'error',
      error instanceof Error
        ? error.message
        : `PaperTrail could not render page ${props.pageNumber}.`,
    )
  } finally {
    pendingCanvas.width = 0
    pendingCanvas.height = 0
    pendingBitmap = null
    rendering.value = false
    void nextTick(() => {
      updateHighlights()
      updateSavedHighlights()
    })
    if (!nearViewport) releaseBitmap()
    if (dirty && nearViewport && !disposed) void renderPage()
  }
}

function showPreview() {
  const preview = props.session.getPagePreview?.(props.pageNumber)
  const displayed = canvas.value
  if (preview && displayed) {
    displayed.width = preview.width
    displayed.height = preview.height
    displayed.getContext('2d', { alpha: false })?.drawImage(preview, 0, 0)
    previewed.value = true
  }
}

function releaseBitmap() {
  const displayed = canvas.value
  if (!displayed) return
  displayed.width = 0
  displayed.height = 0
  highlightRects.value = []
  savedRects.value = []
  releaseTextSelection?.()
  releaseTextSelection = undefined
  textLayer.value?.replaceChildren()
  rendered.value = false
  previewed.value = false
  dirty = true
}

function updateProximity(next: boolean) {
  nearViewport = next
  if (next) {
    if (!rendered.value && !previewed.value) showPreview()
    void renderPage()
  } else {
    renderSequence += 1
    dirty = true
    if (pendingBitmap) void props.session.cancelRender?.(pendingBitmap).catch(() => undefined)
    releaseBitmap()
  }
}

function checkScrollPosition() {
  if (disposed) return
  cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(() => {
    const element = root.value
    const pane = props.scrollRoot
    if (!element || !pane) return
    const box = element.getBoundingClientRect()
    const bounds = pane.getBoundingClientRect()
    const next = box.bottom >= bounds.top - 700 && box.top <= bounds.bottom + 700
    if (next !== nearViewport || dirty) updateProximity(next)
  })
}

function observePage() {
  const element = root.value
  if (!element) return

  if (typeof IntersectionObserver === 'undefined') {
    nearViewport = true
    void renderPage()
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (!entry) return

      if (entry.isIntersecting !== nearViewport || dirty) updateProximity(entry.isIntersecting)
    },
    {
      root: props.scrollRoot,
      rootMargin: '700px 0px',
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
    },
  )
  observer.observe(element)
  visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry)
        emit('visibility', props.pageNumber, entry.isIntersecting ? entry.intersectionRatio : 0)
    },
    { root: props.scrollRoot, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
  )
  visibilityObserver.observe(element)
}

watch(
  () => [props.fitMode, props.zoom, props.availableWidth, props.availableHeight] as const,
  () => {
    renderSequence += 1
    dirty = true
    void renderPage()
    checkScrollPosition()
  },
)

watch(
  () => props.scrollRoot,
  (next, previous) => {
    previous?.removeEventListener('scroll', checkScrollPosition)
    next?.addEventListener('scroll', checkScrollPosition, { passive: true })
    observer?.disconnect()
    visibilityObserver?.disconnect()
    observePage()
  },
)
onMounted(() => {
  props.scrollRoot?.addEventListener('scroll', checkScrollPosition, { passive: true })
  observePage()
  if (nearViewport) showPreview()
})

onBeforeUnmount(() => {
  disposed = true
  if (pendingBitmap) void props.session.cancelRender?.(pendingBitmap).catch(() => undefined)
  releaseBitmap()
  cancelAnimationFrame(scrollFrame)
  props.scrollRoot?.removeEventListener('scroll', checkScrollPosition)
  renderSequence += 1
  observer?.disconnect()
  observer = null
  visibilityObserver?.disconnect()
  visibilityObserver = null
})
</script>

<template>
  <article
    :id="`pdf-page-${pageNumber}`"
    ref="root"
    class="pdf-page-shell flex w-full scroll-mt-4 items-start justify-center"
    :aria-label="`PDF page ${pageNumber}`"
    :data-pdf-page="pageNumber"
    :data-render-state="rendering ? 'rendering' : rendered ? 'ready' : 'pending'"
  >
    <div
      class="pdf-page relative shrink-0 bg-white shadow-sm"
      :style="{
        width: `${layout.width}px`,
        height: `${layout.height}px`,
      }"
    >
      <canvas
        ref="canvas"
        width="0"
        height="0"
        class="block max-w-none bg-white"
        :style="{
          visibility: rendered || previewed ? 'visible' : 'hidden',
          width: `${layout.width}px`,
          height: `${layout.height}px`,
        }"
        :aria-label="`Rendered PDF page ${pageNumber}`"
      ></canvas>
      <div class="pdf-saved-overlay absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          v-for="id in [...new Set(savedRects.map((rect) => rect.id))]"
          :key="id"
          class="pdf-saved-group absolute inset-0"
        >
          <span
            v-for="(rect, index) in savedRects.filter((rect) => rect.id === id)"
            :key="`${rect.id}:${index}`"
            class="pdf-saved-highlight"
            :class="{ active: rect.id === activeHighlight }"
            :data-highlight-id="rect.id"
            :style="{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
              backgroundColor: rect.color,
            }"
          />
        </div>
      </div>
      <NoteIndicator
        v-for="item in noteIndicators"
        :key="item.id"
        :note="item.note"
        :label="`Open note on page ${pageNumber}: ${item.note.slice(0, 80)}`"
        :style="{ left: 'calc(100% - 48px)', top: `${item.top * 100}%` }"
        @activate="emit('noteSelected', item.id)"
      />
      <div class="pdf-match-overlay absolute inset-0 pointer-events-none" aria-hidden="true">
        <span
          v-for="(rect, index) in highlightRects"
          :key="index"
          class="pdf-match"
          :class="{ selected: rect.selected }"
          :data-occurrence="rect.occurrence"
          :style="{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }"
        />
      </div>
      <div
        ref="textLayer"
        class="textLayer absolute top-0 left-0 overflow-hidden"
        :style="{ visibility: rendered && !rendering ? 'visible' : 'hidden' }"
        :aria-label="`Selectable text for PDF page ${pageNumber}`"
        @pointerdown="startSavedPointer"
        @pointerup="selectSavedHighlight"
      ></div>
      <div
        v-if="!rendered && !previewed"
        class="absolute inset-0 grid place-items-center bg-white text-sm text-muted"
        role="status"
      >
        Rendering page {{ pageNumber }}…
      </div>
    </div>
  </article>
</template>

<style scoped>
.pdf-page {
  isolation: isolate;
}
.pdf-saved-overlay {
  z-index: 1;
  mix-blend-mode: multiply;
}
.pdf-saved-group {
  opacity: 0.55;
}
.pdf-saved-highlight {
  position: absolute;
  border-radius: 2px;
}
.pdf-saved-highlight.active {
  outline: 2px solid #334155;
}
.pdf-match-overlay {
  z-index: 3;
}
.pdf-match {
  position: absolute;
  background: rgb(250 204 21 / 40%);
  border-radius: 2px;
}
.pdf-match.selected {
  background: rgb(251 146 60 / 55%);
  outline: 1px solid #b45309;
}
/* Copyright 2014 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Adapted PDF.js text-layer layout contract:
 * https://github.com/mozilla/pdf.js/blob/master/web/text_layer_builder.css
 */
.textLayer {
  cursor: text;
  z-index: 2;
  mix-blend-mode: multiply;
  color-scheme: only light;
  text-align: initial;
  line-height: 1;
  letter-spacing: normal;
  word-spacing: normal;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}
.textLayer :deep(span),
.textLayer :deep(br) {
  position: absolute;
  color: transparent;
  white-space: pre;
  cursor: text;
  transform-origin: 0 0;
  user-select: text;
}
.textLayer :deep(> :not(.markedContent)),
.textLayer :deep(.markedContent span:not(.markedContent)) {
  z-index: 1;
  --font-height: 0;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  --scale-x: 1;
  --rotate: 0deg;
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}
.textLayer :deep(span::selection) {
  background: var(--pt-selection-color, rgb(147 197 253 / 35%));
  color: transparent;
}
.textLayer :deep(br::selection) {
  background: transparent;
}
.textLayer :deep(.endOfContent) {
  display: block;
  position: absolute;
  inset: 100% 0 0;
  z-index: 0;
  cursor: text;
  user-select: none;
  -moz-user-select: none;
}
.textLayer.selecting :deep(.endOfContent) {
  top: 0;
}
.textLayer :deep(.markedContent) {
  display: contents;
}
.textLayer[data-main-rotation='90'] {
  transform: rotate(90deg) translateY(-100%);
}
.textLayer[data-main-rotation='180'] {
  transform: rotate(180deg) translate(-100%, -100%);
}
.textLayer[data-main-rotation='270'] {
  transform: rotate(270deg) translateX(-100%);
}
</style>
