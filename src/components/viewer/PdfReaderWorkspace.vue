<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import PdfPageView from './PdfPageView.vue'
import {
  openPdfDocument,
  PdfOpenError,
  type PdfDocumentSession,
  type PdfFitMode,
  type PdfOutlineItem,
  type PdfSearchMatch,
} from '../../features/pdf/pdf-session'
import type { DiscoveredDocument } from '../../features/library/discovery'

const props = defineProps<{
  document: DiscoveredDocument
}>()

const emit = defineEmits<{
  status: [message: string]
}>()

type ReaderPhase = 'loading' | 'ready' | 'error'
type UtilityPanel = 'contents' | 'search' | 'help' | null

interface FlatOutlineItem {
  title: string
  pageNumber: number | null
  depth: number
}

const readerRoot = ref<HTMLElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
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
const panel = ref<UtilityPanel>(null)
const outline = shallowRef<readonly PdfOutlineItem[]>([])
const outlineLoaded = ref(false)
const outlineBusy = ref(false)
const searchQuery = ref('')
const searchMatches = shallowRef<readonly PdfSearchMatch[]>([])
const searchTextPageCount = ref(0)
const searchTruncated = ref(false)
const searchBusy = ref(false)
const searchCompleted = ref(false)
const fullscreen = ref(false)
const visibility = new Map<number, number>()
let openSequence = 0
let resizeFrame = 0
let searchController: AbortController | null = null

const pages = computed(() => Array.from({ length: totalPages.value }, (_, index) => index + 1))

const progressPercent = computed(() =>
  totalPages.value > 0 ? Math.round((currentPage.value / totalPages.value) * 100) : 0,
)

const zoomPercent = computed(() => Math.round(renderedScale.value * 100))

const flatOutline = computed<readonly FlatOutlineItem[]>(() => {
  const result: FlatOutlineItem[] = []

  const visit = (items: readonly PdfOutlineItem[], depth: number) => {
    for (const item of items) {
      result.push({ title: item.title, pageNumber: item.pageNumber, depth })
      visit(item.children, depth + 1)
    }
  }

  visit(outline.value, 0)
  return result
})

const searchSummary = computed(() => {
  if (!searchCompleted.value) return 'Search this PDF’s text layer.'
  if (searchTextPageCount.value === 0) {
    return 'No searchable text was found. Scanned or image-only PDFs require OCR, which is outside PaperTrail 0.1.'
  }

  const count = searchMatches.value.length
  const suffix = searchTruncated.value ? ' Showing the first 200 matches.' : ''
  return `${count} match${count === 1 ? '' : 'es'} across searchable text.${suffix}`
})

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

function resetUtilities() {
  searchController?.abort()
  searchController = null
  panel.value = null
  outline.value = []
  outlineLoaded.value = false
  outlineBusy.value = false
  searchQuery.value = ''
  searchMatches.value = []
  searchTextPageCount.value = 0
  searchTruncated.value = false
  searchBusy.value = false
  searchCompleted.value = false
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
  resetUtilities()

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
  document.getElementById(`pdf-page-${next}`)?.scrollIntoView?.({
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

async function loadOutline() {
  const current = session.value
  if (!current || outlineLoaded.value || outlineBusy.value) return

  outlineBusy.value = true
  try {
    outline.value = await current.getOutline()
  } catch {
    outline.value = []
  } finally {
    outlineLoaded.value = true
    outlineBusy.value = false
  }
}

async function openPanel(next: Exclude<UtilityPanel, null>) {
  panel.value = panel.value === next ? null : next
  if (panel.value === 'contents') void loadOutline()
  if (panel.value === 'search') {
    await nextTick()
    searchInput.value?.focus()
  }
}

async function performSearch() {
  const current = session.value
  const query = searchQuery.value.trim()
  if (!current || !query) return

  searchController?.abort()
  const controller = new AbortController()
  searchController = controller
  searchBusy.value = true
  searchCompleted.value = false

  try {
    const result = await current.searchText(query, { signal: controller.signal })
    if (searchController !== controller) return

    searchMatches.value = result.matches
    searchTextPageCount.value = result.textPageCount
    searchTruncated.value = result.truncated
    searchCompleted.value = true
    emit(
      'status',
      result.textPageCount === 0
        ? 'No searchable PDF text found.'
        : `${result.matches.length} PDF search matches found.`,
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (searchController !== controller) return

    searchMatches.value = []
    searchTextPageCount.value = 0
    searchTruncated.value = false
    searchCompleted.value = true
    emit('status', 'PDF search could not be completed.')
  } finally {
    if (searchController === controller) searchBusy.value = false
  }
}

async function toggleFullscreen() {
  const root = readerRoot.value
  if (!root) return

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await root.requestFullscreen()
    }
  } catch {
    emit('status', 'Fullscreen is not available in this browser context.')
  }
}

function handleFullscreenChange() {
  fullscreen.value = document.fullscreenElement === readerRoot.value
  scheduleViewportMeasure()
  emit('status', fullscreen.value ? 'Fullscreen enabled.' : 'Fullscreen exited.')
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  const tag = element.tagName.toLocaleLowerCase()
  return element.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'
}

function handleShortcut(event: KeyboardEvent) {
  if (phase.value !== 'ready') return

  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'f') {
    event.preventDefault()
    void openPanel('search')
    return
  }

  if (isTypingTarget(event.target)) {
    if (event.key === 'Escape') panel.value = null
    return
  }

  switch (event.key) {
    case '/':
      event.preventDefault()
      void openPanel('search')
      break
    case 'c':
    case 'C':
      event.preventDefault()
      void openPanel('contents')
      break
    case 'f':
    case 'F':
      event.preventDefault()
      void toggleFullscreen()
      break
    case '?':
      event.preventDefault()
      void openPanel('help')
      break
    case 'ArrowRight':
    case 'PageDown':
      event.preventDefault()
      void goToPage(currentPage.value + 1)
      break
    case 'ArrowLeft':
    case 'PageUp':
      event.preventDefault()
      void goToPage(currentPage.value - 1)
      break
    case 'Escape':
      panel.value = null
      break
  }
}

onMounted(() => {
  void openDocument()
  globalThis.addEventListener('resize', scheduleViewportMeasure)
  globalThis.addEventListener('keydown', handleShortcut)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

watch(
  () => props.document.id,
  () => void openDocument(),
)

onBeforeUnmount(() => {
  openSequence += 1
  searchController?.abort()
  cancelAnimationFrame(resizeFrame)
  globalThis.removeEventListener('resize', scheduleViewportMeasure)
  globalThis.removeEventListener('keydown', handleShortcut)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (document.fullscreenElement === readerRoot.value) void document.exitFullscreen()
  void closeCurrentSession()
})
</script>

<template>
  <div ref="readerRoot" class="min-w-0 bg-canvas">
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
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm"
          :aria-pressed="panel === 'contents'"
          @click="openPanel('contents')"
        >
          Contents
        </button>
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm"
          :aria-pressed="panel === 'search'"
          @click="openPanel('search')"
        >
          Search
        </button>
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm"
          :aria-pressed="fullscreen"
          @click="toggleFullscreen"
        >
          {{ fullscreen ? 'Exit fullscreen' : 'Fullscreen' }}
        </button>
        <button
          type="button"
          class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm"
          :aria-pressed="panel === 'help'"
          aria-label="Keyboard help"
          @click="openPanel('help')"
        >
          ?
        </button>
      </div>
    </header>

    <div v-if="phase === 'ready' && panel" class="border-b border-line bg-panel px-5 py-4 sm:px-8">
      <section v-if="panel === 'contents'" aria-labelledby="pdf-contents-title">
        <div class="flex items-center justify-between gap-3">
          <h3 id="pdf-contents-title" class="font-semibold">Contents</h3>
          <button type="button" class="text-sm text-muted" @click="panel = null">Close</button>
        </div>
        <p v-if="outlineBusy" class="mt-3 text-sm text-muted" role="status">Loading PDF outline…</p>
        <p v-else-if="outlineLoaded && flatOutline.length === 0" class="mt-3 text-sm text-muted">
          This PDF does not provide an outline.
        </p>
        <ul v-else-if="flatOutline.length > 0" class="mt-3 max-h-52 space-y-1 overflow-auto">
          <li v-for="(item, index) in flatOutline" :key="`${item.title}-${index}`">
            <button
              v-if="item.pageNumber"
              type="button"
              class="min-h-9 w-full rounded-md px-2 py-1 text-left text-sm hover:bg-canvas"
              :style="{ paddingInlineStart: `${item.depth * 16 + 8}px` }"
              @click="goToPage(item.pageNumber)"
            >
              {{ item.title }}
              <span class="text-xs text-muted">· page {{ item.pageNumber }}</span>
            </button>
            <p
              v-else
              class="px-2 py-1 text-sm text-muted"
              :style="{ paddingInlineStart: `${item.depth * 16 + 8}px` }"
            >
              {{ item.title }}
            </p>
          </li>
        </ul>
      </section>

      <section v-else-if="panel === 'search'" aria-labelledby="pdf-search-title">
        <div class="flex items-center justify-between gap-3">
          <h3 id="pdf-search-title" class="font-semibold">Search document</h3>
          <button type="button" class="text-sm text-muted" @click="panel = null">Close</button>
        </div>
        <form class="mt-3 flex flex-wrap gap-2" role="search" @submit.prevent="performSearch">
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="search"
            class="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
            placeholder="Search PDF text"
            aria-label="Search PDF text"
          />
          <button
            type="submit"
            class="min-h-10 rounded-lg border border-line px-3 py-2 text-sm font-medium"
            :disabled="searchBusy || !searchQuery.trim()"
          >
            {{ searchBusy ? 'Searching…' : 'Search' }}
          </button>
        </form>
        <p class="mt-2 text-xs leading-relaxed text-muted" role="status" aria-live="polite">
          {{ searchSummary }}
        </p>
        <ul v-if="searchMatches.length > 0" class="mt-3 max-h-56 space-y-2 overflow-auto">
          <li v-for="match in searchMatches" :key="`${match.pageNumber}-${match.occurrence}`">
            <button
              type="button"
              class="w-full rounded-lg border border-line p-2 text-left hover:bg-canvas"
              @click="goToPage(match.pageNumber)"
            >
              <span class="block text-xs font-semibold text-brand">
                Page {{ match.pageNumber }}
              </span>
              <span class="mt-1 block text-sm leading-relaxed text-muted">
                {{ match.excerpt }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section v-else aria-labelledby="pdf-help-title">
        <div class="flex items-center justify-between gap-3">
          <h3 id="pdf-help-title" class="font-semibold">Keyboard help</h3>
          <button type="button" class="text-sm text-muted" @click="panel = null">Close</button>
        </div>
        <dl class="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt class="font-medium">Ctrl/⌘ + F or /</dt>
          <dd class="text-muted">Focus PDF search.</dd>
          <dt class="font-medium">C</dt>
          <dd class="text-muted">Toggle contents.</dd>
          <dt class="font-medium">F</dt>
          <dd class="text-muted">Toggle fullscreen.</dd>
          <dt class="font-medium">← / Page Up</dt>
          <dd class="text-muted">Previous page.</dd>
          <dt class="font-medium">→ / Page Down</dt>
          <dd class="text-muted">Next page.</dd>
          <dt class="font-medium">?</dt>
          <dd class="text-muted">Toggle this help.</dd>
          <dt class="font-medium">Mouse / touch selection</dt>
          <dd class="text-muted">Select text from text-based PDFs for normal browser copy.</dd>
        </dl>
      </section>
    </div>

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
