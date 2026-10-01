<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import PdfPageView from './PdfPageView.vue'
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

const viewport = ref<HTMLElement | null>(null)
const session = shallowRef<PdfDocumentSession | null>(null)
const phase = ref<ReaderPhase>('loading')
const errorMessage = ref('')
const currentPage = ref(1)
const totalPages = ref(0)
const zoom = ref(1)
const fitMode = ref<PdfFitMode>('width')
const renderedScale = ref(1)
const availableWidth = ref(720)
const availableHeight = ref(900)
const visibility = new Map<number, number>()
let openSequence = 0
let resizeFrame = 0

const pages = computed(() => Array.from({ length: totalPages.value }, (_, index) => index + 1))

const progressPercent = computed(() =>
  totalPages.value > 0 ? Math.round((currentPage.value / totalPages.value) * 100) : 0,
)

const zoomPercent = computed(() => Math.round(renderedScale.value * 100))

function clampPage(page: number): number {
  if (totalPages.value < 1) return 1
  return Math.min(totalPages.value, Math.max(1, Math.round(page)))
}

function measureViewport() {
  const element = viewport.value
  if (!element) return

  availableWidth.value = Math.max(240, element.clientWidth - 32)
  availableHeight.value = Math.max(320, element.clientHeight - 32)
}

function scheduleViewportMeasure() {
  cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(measureViewport)
}

async function closeCurrentSession() {
  const current = session.value
  session.value = null
  if (current) await current.close()
}

async function openDocument() {
  const sequence = ++openSequence
  phase.value = 'loading'
  errorMessage.value = ''
  currentPage.value = 1
  totalPages.value = 0
  fitMode.value = 'width'
  zoom.value = 1
  renderedScale.value = 1
  visibility.clear()

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
    measureViewport()
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
  currentPage.value = next
  await nextTick()
  document.getElementById(`pdf-page-${next}`)?.scrollIntoView({
    block: 'start',
    behavior: 'smooth',
  })
  emit('status', `Page ${next} of ${totalPages.value}.`)
}

function chooseMostVisiblePage() {
  let bestPage = currentPage.value
  let bestRatio = -1

  for (const [pageNumber, ratio] of visibility) {
    if (ratio > bestRatio || (ratio === bestRatio && pageNumber < bestPage)) {
      bestPage = pageNumber
      bestRatio = ratio
    }
  }

  if (bestRatio > 0 && bestPage !== currentPage.value) {
    currentPage.value = bestPage
    emit('status', `Page ${bestPage} of ${totalPages.value}.`)
  }
}

function handleVisibility(pageNumber: number, ratio: number) {
  if (ratio > 0) visibility.set(pageNumber, ratio)
  else visibility.delete(pageNumber)
  chooseMostVisiblePage()
}

function handleRendered(pageNumber: number, scale: number) {
  if (pageNumber === currentPage.value) renderedScale.value = scale
}

function handleRenderError(message: string) {
  phase.value = 'error'
  errorMessage.value = message
  emit('status', message)
}

function changeZoom(delta: number) {
  fitMode.value = 'custom'
  zoom.value = Math.min(4, Math.max(0.25, renderedScale.value + delta))
  emit('status', `PDF zoom set to ${Math.round(zoom.value * 100)}%.`)
}

function setFit(mode: Extract<PdfFitMode, 'width' | 'page'>) {
  fitMode.value = mode
  emit('status', mode === 'width' ? 'Fit width enabled.' : 'Fit page enabled.')
}

function handlePageInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  void goToPage(Number(input.value))
}

function handleSlider(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  void goToPage(Number(input.value))
}

onMounted(() => {
  void openDocument()
  globalThis.addEventListener('resize', scheduleViewportMeasure)
})

watch(
  () => props.document.id,
  () => void openDocument(),
)

onBeforeUnmount(() => {
  openSequence += 1
  cancelAnimationFrame(resizeFrame)
  globalThis.removeEventListener('resize', scheduleViewportMeasure)
  void closeCurrentSession()
})
</script>

<template>
  <div class="min-w-0">
    <header
      class="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel px-5 py-4 sm:px-8"
    >
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold tracking-wider text-brand uppercase">
          PDF · local document
        </p>
        <h2 id="reader-title" class="mt-1 break-words text-lg font-semibold">
          {{ document.name }}
        </h2>
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
      class="h-[70vh] min-w-0 overflow-auto bg-canvas p-4 sm:p-6"
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

      <div v-else-if="session" class="flex min-w-0 flex-col items-center gap-6">
        <input
          v-if="totalPages > 1"
          :value="currentPage"
          type="range"
          min="1"
          :max="totalPages"
          step="1"
          class="sticky top-0 z-10 w-full max-w-2xl bg-canvas py-2"
          aria-label="PDF page progress"
          @input="handleSlider"
        />

        <PdfPageView
          v-for="pageNumber in pages"
          :key="pageNumber"
          :session="session"
          :page-number="pageNumber"
          :fit-mode="fitMode"
          :zoom="zoom"
          :available-width="availableWidth"
          :available-height="availableHeight"
          @visibility="handleVisibility"
          @rendered="handleRendered"
          @error="handleRenderError"
        />
      </div>
    </section>
  </div>
</template>
