<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  openPdfDocument,
  PdfOpenError,
  type PdfDocumentSession,
  type PdfFitMode,
} from '../../features/pdf/pdf-session'
import type { DiscoveredDocument } from '../../features/library/discovery'

const props = defineProps<{
  document: DiscoveredDocument
}>()

const emit = defineEmits<{
  status: [message: string]
}>()

type ReaderPhase = 'loading' | 'ready' | 'error'

const canvas = ref<HTMLCanvasElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const session = shallowRef<PdfDocumentSession | null>(null)
const phase = ref<ReaderPhase>('loading')
const errorMessage = ref('')
const currentPage = ref(1)
const totalPages = ref(0)
const zoom = ref(1)
const fitMode = ref<PdfFitMode>('width')
const renderedScale = ref(1)
let openSequence = 0
let renderSequence = 0

const progressPercent = computed(() =>
  totalPages.value > 0 ? Math.round((currentPage.value / totalPages.value) * 100) : 0,
)

const zoomPercent = computed(() => Math.round(renderedScale.value * 100))

function clampPage(page: number): number {
  if (totalPages.value < 1) return 1
  return Math.min(totalPages.value, Math.max(1, Math.round(page)))
}

async function closeCurrentSession() {
  const current = session.value
  session.value = null
  if (current) await current.close()
}

async function renderCurrentPage() {
  const currentSession = session.value
  const currentCanvas = canvas.value
  const currentViewport = viewport.value
  if (!currentSession || !currentCanvas || !currentViewport || phase.value !== 'ready') return

  const sequence = ++renderSequence
  const availableWidth = Math.max(240, currentViewport.clientWidth - 32)
  const availableHeight = Math.max(320, currentViewport.clientHeight - 32)

  try {
    const result = await currentSession.render({
      canvas: currentCanvas,
      pageNumber: currentPage.value,
      fitMode: fitMode.value,
      zoom: zoom.value,
      availableWidth,
      availableHeight,
    })

    if (sequence !== renderSequence) return
    renderedScale.value = result.scale
    emit('status', `Page ${currentPage.value} of ${totalPages.value} rendered.`)
  } catch (error) {
    if (sequence !== renderSequence) return
    if (error instanceof Error && error.name === 'RenderingCancelledException') return
    phase.value = 'error'
    errorMessage.value =
      error instanceof Error ? error.message : 'PaperTrail could not render this PDF page.'
    emit('status', errorMessage.value)
  }
}

async function openDocument() {
  const sequence = ++openSequence
  renderSequence += 1
  phase.value = 'loading'
  errorMessage.value = ''
  currentPage.value = 1
  totalPages.value = 0
  fitMode.value = 'width'
  zoom.value = 1
  renderedScale.value = 1

  await closeCurrentSession()

  try {
    const next = await openPdfDocument(props.document.file)
    if (sequence !== openSequence) {
      await next.close()
      return
    }

    session.value = next
    totalPages.value = next.totalPages
    phase.value = 'ready'
    emit('status', `Opened ${props.document.name}. ${next.totalPages} pages.`)
    await nextTick()
    await renderCurrentPage()
  } catch (error) {
    if (sequence !== openSequence) return
    phase.value = 'error'
    errorMessage.value =
      error instanceof PdfOpenError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'PaperTrail could not open this PDF.'
    emit('status', errorMessage.value)
  }
}

async function goToPage(page: number) {
  const next = clampPage(page)
  if (next === currentPage.value) return
  currentPage.value = next
  await renderCurrentPage()
}

async function changeZoom(delta: number) {
  fitMode.value = 'custom'
  zoom.value = Math.min(4, Math.max(0.25, renderedScale.value + delta))
  await renderCurrentPage()
}

async function setFit(mode: Extract<PdfFitMode, 'width' | 'page'>) {
  fitMode.value = mode
  await renderCurrentPage()
}

function handlePageInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  void goToPage(Number(input.value))
}

function handleSlider(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  void goToPage(Number(input.value))
}

function handleResize() {
  if (fitMode.value !== 'custom') void renderCurrentPage()
}

onMounted(() => {
  void openDocument()
  globalThis.addEventListener('resize', handleResize)
})

watch(
  () => props.document.id,
  () => void openDocument(),
)

onBeforeUnmount(() => {
  openSequence += 1
  renderSequence += 1
  globalThis.removeEventListener('resize', handleResize)
  void closeCurrentSession()
})
</script>

<template>
  <div class="min-w-0">
    <header
      class="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel px-5 py-4 sm:px-8"
    >
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold tracking-wider text-brand uppercase">PDF · local document</p>
        <h2 id="reader-title" class="mt-1 break-words text-lg font-semibold">{{ document.name }}</h2>
        <p v-if="phase === 'ready'" class="mt-1 text-xs text-muted">
          Page {{ currentPage }} of {{ totalPages }} · {{ progressPercent }}% · {{ zoomPercent }}%
        </p>
      </div>

      <div
        v-if="phase === 'ready'"
        class="flex flex-wrap items-center gap-2"
        aria-label="PDF reader controls"
      >
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          Previous
        </button>
        <label class="flex items-center gap-2 text-sm">
          <span class="sr-only">Current page</span>
          <input
            :value="currentPage"
            type="number"
            min="1"
            :max="totalPages"
            class="w-20 rounded-lg border border-line bg-canvas px-2 py-2"
            aria-label="Current page"
            @change="handlePageInput"
          />
        </label>
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >
          Next
        </button>
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm"
          aria-label="Zoom out"
          @click="changeZoom(-0.25)"
        >
          −
        </button>
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm"
          aria-label="Zoom in"
          @click="changeZoom(0.25)"
        >
          +
        </button>
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm"
          :aria-pressed="fitMode === 'width'"
          @click="setFit('width')"
        >
          Fit width
        </button>
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm"
          :aria-pressed="fitMode === 'page'"
          @click="setFit('page')"
        >
          Fit page
        </button>
      </div>
    </header>

    <section
      ref="viewport"
      class="min-h-[70vh] min-w-0 overflow-auto bg-canvas p-4 sm:p-6"
      aria-labelledby="reader-title"
    >
      <div
        v-if="phase === 'loading'"
        class="mx-auto max-w-2xl rounded-lg border border-line bg-panel p-5 text-sm text-muted"
        role="status"
        aria-live="polite"
      >
        Opening {{ document.name }}…
      </div>

      <div
        v-else-if="phase === 'error'"
        class="mx-auto max-w-2xl rounded-lg border border-line bg-panel p-5"
        role="alert"
      >
        <p class="font-medium">PaperTrail could not open this PDF</p>
        <p class="mt-2 text-sm leading-relaxed text-muted">{{ errorMessage }}</p>
      </div>

      <div v-else class="flex min-w-max flex-col items-center gap-4">
        <input
          v-if="totalPages > 1"
          :value="currentPage"
          type="range"
          min="1"
          :max="totalPages"
          step="1"
          class="w-full max-w-2xl"
          aria-label="PDF page progress"
          @input="handleSlider"
        />
        <canvas
          ref="canvas"
          class="max-w-none rounded-sm bg-white shadow-sm"
          aria-label="Rendered PDF page"
        ></canvas>
      </div>
    </section>
  </div>
</template>
