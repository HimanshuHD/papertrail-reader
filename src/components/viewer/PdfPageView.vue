<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
}>()

const emit = defineEmits<{
  visibility: [pageNumber: number, ratio: number]
  rendered: [pageNumber: number, scale: number]
  error: [message: string]
}>()

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const textLayer = ref<HTMLElement | null>(null)
const rendered = ref(false)
const rendering = ref(false)
const dimensions = ref<{ width: number; height: number } | null>(null)
const layout = computed(() => {
  const size = dimensions.value ?? { width: 612, height: 792 }
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

async function renderPage() {
  if (!nearViewport || rendering.value || !dirty || !dimensions.value || disposed) return
  const currentCanvas = canvas.value
  const currentTextLayer = textLayer.value
  if (!currentCanvas || !currentTextLayer) return

  const pendingCanvas = document.createElement('canvas')
  const pendingText = document.createElement('div')
  const sequence = ++renderSequence
  rendering.value = true
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
    currentTextLayer.replaceChildren(...pendingText.childNodes)
    rendered.value = true
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
    rendering.value = false
    if (dirty && nearViewport && !disposed) void renderPage()
  }
}

function checkScrollPosition() {
  if (!dirty || disposed) return
  cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(() => {
    const element = root.value
    const pane = props.scrollRoot
    if (!element || !pane) return
    const box = element.getBoundingClientRect()
    const bounds = pane.getBoundingClientRect()
    nearViewport = box.bottom >= bounds.top - 700 && box.top <= bounds.bottom + 700
    if (nearViewport) void renderPage()
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

      nearViewport = entry.isIntersecting
      if (entry.isIntersecting) void renderPage()
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
onMounted(async () => {
  props.scrollRoot?.addEventListener('scroll', checkScrollPosition, { passive: true })
  observePage()
  try {
    const size = await props.session.getPageDimensions(props.pageNumber)
    if (disposed) return
    dimensions.value = size
    void renderPage()
  } catch (error) {
    if (!disposed)
      emit('error', error instanceof Error ? error.message : 'Unable to measure PDF page.')
  }
})

onBeforeUnmount(() => {
  disposed = true
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
        class="block max-w-none bg-white"
        :style="{
          visibility: rendered ? 'visible' : 'hidden',
          width: `${layout.width}px`,
          height: `${layout.height}px`,
        }"
        :aria-label="`Rendered PDF page ${pageNumber}`"
      ></canvas>
      <div
        ref="textLayer"
        class="textLayer absolute top-0 left-0 overflow-hidden"
        :style="{ visibility: rendered && !rendering ? 'visible' : 'hidden' }"
        :aria-label="`Selectable text for PDF page ${pageNumber}`"
      ></div>
      <div
        v-if="!rendered"
        class="absolute inset-0 grid place-items-center bg-white text-sm text-muted"
        role="status"
      >
        Rendering page {{ pageNumber }}…
      </div>
    </div>
  </article>
</template>

<style scoped>
.textLayer {
  z-index: 2;
  line-height: 1;
  text-size-adjust: none;
  transform-origin: 0 0;
}

.textLayer :deep(span),
.textLayer :deep(br) {
  position: absolute;
  color: transparent;
  white-space: pre;
  cursor: text;
  transform-origin: 0 0;
}

.textLayer :deep(span::selection) {
  background: Highlight;
  color: transparent;
}

.textLayer :deep(.markedContent) {
  position: absolute;
  top: 0;
  left: 0;
}
</style>
