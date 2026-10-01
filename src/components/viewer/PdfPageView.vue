<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PdfDocumentSession, PdfFitMode } from '../../features/pdf/pdf-session'

const props = defineProps<{
  session: PdfDocumentSession
  pageNumber: number
  fitMode: PdfFitMode
  zoom: number
  availableWidth: number
  availableHeight: number
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
const pageWidth = ref(0)
const pageHeight = ref(0)
let observer: IntersectionObserver | null = null
let renderSequence = 0
let nearViewport = false

async function renderPage() {
  if (!nearViewport || rendering.value) return
  const currentCanvas = canvas.value
  const currentTextLayer = textLayer.value
  if (!currentCanvas || !currentTextLayer) return

  const sequence = ++renderSequence
  rendering.value = true

  try {
    const result = await props.session.render({
      canvas: currentCanvas,
      textLayer: currentTextLayer,
      pageNumber: props.pageNumber,
      fitMode: props.fitMode,
      zoom: props.zoom,
      availableWidth: props.availableWidth,
      availableHeight: props.availableHeight,
    })
    if (sequence !== renderSequence) return

    pageWidth.value = result.width
    pageHeight.value = result.height
    rendered.value = true
    emit('rendered', props.pageNumber, result.scale)
  } catch (error) {
    if (sequence !== renderSequence) return
    if (
      error instanceof Error &&
      (error.name === 'RenderingCancelledException' || error.message === 'TextLayer task cancelled.')
    ) {
      return
    }

    emit(
      'error',
      error instanceof Error ? error.message : `PaperTrail could not render page ${props.pageNumber}.`,
    )
  } finally {
    if (sequence === renderSequence) rendering.value = false
  }
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
      emit('visibility', props.pageNumber, entry.isIntersecting ? entry.intersectionRatio : 0)
      if (entry.isIntersecting) void renderPage()
    },
    {
      root: null,
      rootMargin: '700px 0px',
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
    },
  )
  observer.observe(element)
}

watch(
  () => [props.fitMode, props.zoom, props.availableWidth, props.availableHeight] as const,
  async () => {
    if (!nearViewport) return
    renderSequence += 1
    rendering.value = false
    await nextTick()
    void renderPage()
  },
)

onMounted(observePage)

onBeforeUnmount(() => {
  renderSequence += 1
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <article
    ref="root"
    :id="`pdf-page-${pageNumber}`"
    class="pdf-page-shell flex min-h-[65vh] w-full scroll-mt-4 items-start justify-center"
    :aria-label="`PDF page ${pageNumber}`"
  >
    <div
      class="pdf-page relative bg-white shadow-sm"
      :style="{
        width: pageWidth ? `${pageWidth}px` : 'min(100%, 720px)',
        height: pageHeight ? `${pageHeight}px` : '65vh',
      }"
    >
      <canvas
        ref="canvas"
        class="block max-w-none"
        :aria-label="`Rendered PDF page ${pageNumber}`"
      ></canvas>
      <div
        ref="textLayer"
        class="textLayer absolute top-0 left-0 overflow-hidden"
        :aria-label="`Selectable text for PDF page ${pageNumber}`"
      ></div>
      <div
        v-if="!rendered && rendering"
        class="absolute inset-0 grid place-items-center text-sm text-muted"
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
