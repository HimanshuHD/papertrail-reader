<script setup lang="ts">
import { hideTransitionSurface, restoreTransitionSurface } from '../../services/transition-surface'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import LoadingState from '../LoadingState.vue'
import { useReadingContinuity } from '../../composables/useReadingContinuity'
import IconButton from '../IconButton.vue'
import PdfPageView from './PdfPageView.vue'
import {
  openPdfDocument,
  resolvePdfScale,
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

type ReaderPhase = 'loading' | 'restoring' | 'ready' | 'error'
type UtilityPanel = 'contents' | 'search' | null
type UtilityPopover = 'search' | 'help' | null

interface FlatOutlineItem {
  title: string
  pageNumber: number | null
  depth: number
}

const readerRoot = ref<HTMLElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const popoverRoot = ref<HTMLElement | null>(null)
const session = shallowRef<PdfDocumentSession | null>(null)
const phase = ref<ReaderPhase>('loading')
const errorMessage = ref('')
const currentPage = ref(1)
const pageEditing = ref(false)
const pageDraft = ref('1')
const continuity = useReadingContinuity()
const persistenceNotice = continuity.notice
const totalPages = ref(0)
const zoom = ref(1)
const fitMode = ref<PdfFitMode>('width')
watch(
  [currentPage, fitMode, zoom],
  () => {
    if (phase.value === 'ready')
      continuity.save(currentPage.value, { fitMode: fitMode.value, zoom: zoom.value })
  },
  { flush: 'sync' },
)
const renderedScale = ref(1)
const availableWidth = ref(720)
const availableHeight = ref(900)
const rightPanel = ref<UtilityPanel>(null)
const popover = ref<UtilityPopover>(null)
const outline = shallowRef<readonly PdfOutlineItem[]>([])
const outlineLoaded = ref(false)
const outlineBusy = ref(false)
const searchQuery = ref('')
const completedSearchQuery = ref('')
const selectedSearchMatch = ref<{ pageNumber: number; occurrence: number; request: number } | null>(
  null,
)
let searchSelectionRequest = 0
watch(searchQuery, () => {
  searchController?.abort()
  searchController = null
  searchBusy.value = false
  completedSearchQuery.value = ''
  selectedSearchMatch.value = null
  searchSelectionRequest += 1
  searchMatches.value = []
  searchCompleted.value = false
})
async function selectSearchMatch(match: PdfSearchMatch) {
  const request = ++searchSelectionRequest
  const query = completedSearchQuery.value
  await goToPage(match.pageNumber)
  if (request !== searchSelectionRequest || query !== completedSearchQuery.value) return
  selectedSearchMatch.value = {
    pageNumber: match.pageNumber,
    occurrence: match.occurrence,
    request,
  }
}

const searchMatches = shallowRef<readonly PdfSearchMatch[]>([])
const searchTextPageCount = ref(0)
const searchTruncated = ref(false)
const searchBusy = ref(false)
const searchCompleted = ref(false)
const searchError = ref('')
const fullscreen = ref(false)
let openSequence = 0
let resizeFrame = 0
let scrollFrame = 0
let layoutOperation = 0
let resizeObserver: ResizeObserver | null = null
let searchController: AbortController | null = null
let documentController: AbortController | null = null

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
  if (searchError.value) return searchError.value
  if (searchBusy.value) return 'Searching PDF text…'
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

  const atEnd =
    element.scrollHeight > element.clientHeight &&
    element.scrollHeight - element.scrollTop - element.clientHeight < 2
  const preservePosition = phase.value === 'ready'
  const readingPoint = preservePosition ? captureReadingPoint() : null
  const operation = layoutOperation
  const scrollBefore = element.scrollTop
  const previousWidth = availableWidth.value
  const previousHeight = availableHeight.value
  const style = getComputedStyle(element)
  availableWidth.value = Math.max(
    1,
    element.clientWidth -
      parseFloat(style.paddingLeft || '0') -
      parseFloat(style.paddingRight || '0'),
  )
  availableHeight.value = Math.max(
    1,
    element.clientHeight -
      parseFloat(style.paddingTop || '0') -
      parseFloat(style.paddingBottom || '0'),
  )
  if (previousWidth !== availableWidth.value || previousHeight !== availableHeight.value) {
    void nextTick(() => {
      if (!preservePosition || viewport.value !== element || operation !== layoutOperation) return
      if (Math.abs(element.scrollTop - scrollBefore) > 1) return
      if (atEnd) element.scrollTop = element.scrollHeight
      else void restoreReadingPoint(readingPoint)
    })
  }
}

function scheduleViewportMeasure() {
  cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(measureViewport)
}

function resetUtilities() {
  searchController?.abort()
  searchController = null
  rightPanel.value = null
  popover.value = null
  outline.value = []
  outlineLoaded.value = false
  outlineBusy.value = false
  searchQuery.value = ''
  searchMatches.value = []
  searchTextPageCount.value = 0
  searchTruncated.value = false
  searchBusy.value = false
  searchCompleted.value = false
  searchError.value = ''
}

async function closeCurrentSession() {
  const current = session.value
  session.value = null
  if (current) await current.close()
}

async function openDocument() {
  continuity.reset()
  documentController?.abort()
  const controller = new AbortController()
  documentController = controller
  const sequence = ++openSequence
  phase.value = 'loading'
  if (viewport.value) {
    viewport.value.scrollTop = 0
    viewport.value.scrollLeft = 0
  }
  completingRestore = false
  errorMessage.value = ''
  currentPage.value = 1
  pageEditing.value = false
  pageDraft.value = '1'
  totalPages.value = 0
  fitMode.value = 'width'
  zoom.value = 1
  renderedScale.value = 1
  resetUtilities()

  await closeCurrentSession()

  try {
    const next = await openPdfDocument(props.document.file, undefined, controller.signal)
    if (sequence !== openSequence) {
      await next.close()
      return
    }

    const restored = await continuity.restore(props.document.file, next.totalPages)
    if (sequence !== openSequence) {
      await next.close()
      return
    }
    currentPage.value = restored?.page ?? 1
    fitMode.value = restored?.view.fitMode ?? 'width'
    zoom.value = restored?.view.zoom ?? 1
    renderedScale.value = zoom.value
    phase.value = 'restoring'
    session.value = next
    totalPages.value = next.totalPages
    await nextTick()
    measureViewport()
    if (currentPage.value !== 1) await goToPage(currentPage.value)
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
  layoutOperation += 1
  const next = clampPage(page)
  currentPage.value = next
  await nextTick()
  const pageElement = viewport.value?.querySelector<HTMLElement>(`#pdf-page-${next}`)
  const scrollElement = viewport.value
  if (pageElement && scrollElement) {
    const top =
      pageElement.getBoundingClientRect().top -
      scrollElement.getBoundingClientRect().top +
      scrollElement.scrollTop
    scrollElement.scrollTo?.({ top, behavior: 'instant' })
  }
  emit('status', `Page ${next} of ${totalPages.value}.`)
}

function chooseMostVisiblePage() {
  if (phase.value !== 'ready') return
  const pane = viewport.value
  if (!pane) return
  const bounds = pane.getBoundingClientRect()
  let bestPage = currentPage.value
  let bestPixels = 0
  for (const element of pane.querySelectorAll<HTMLElement>('.pdf-page-shell')) {
    const box = element.getBoundingClientRect()
    const pixels = Math.max(
      0,
      Math.min(box.bottom, bounds.top + pane.clientHeight) - Math.max(box.top, bounds.top),
    )
    if (pixels > bestPixels) {
      bestPixels = pixels
      bestPage = Number(element.id.replace('pdf-page-', ''))
    }
  }
  if (bestPixels > 0 && bestPage !== currentPage.value) {
    currentPage.value = bestPage
    emit('status', `Page ${bestPage} of ${totalPages.value}.`)
  }
}

function handleViewerScroll() {
  cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(chooseMostVisiblePage)
}

function handleVisibility() {
  handleViewerScroll()
}

function stepPage(delta: number) {
  chooseMostVisiblePage()
  void goToPage(currentPage.value + delta)
}

let completingRestore = false
async function handleRendered(pageNumber: number, scale: number) {
  if (pageNumber !== currentPage.value) return
  renderedScale.value = scale
  if (phase.value !== 'restoring' || completingRestore) return
  completingRestore = true
  const sequence = openSequence
  try {
    // Target dimensions and bitmap are ready; align while the pages remain hidden.
    if (pageNumber !== 1) await goToPage(pageNumber)
    await nextTick()
    if (sequence !== openSequence || phase.value !== 'restoring') return
    phase.value = 'ready'
    continuity.save(currentPage.value, { fitMode: fitMode.value, zoom: zoom.value })
    emit(
      'status',
      `Opened ${props.document.name}. Page ${currentPage.value} of ${totalPages.value}.`,
    )
  } finally {
    if (sequence === openSequence) completingRestore = false
  }
}

function handleRenderError(message: string) {
  phase.value = 'error'
  errorMessage.value = message
  emit('status', message)
}

function captureReadingPoint() {
  const pane = viewport.value
  if (!pane) return null
  const bounds = pane.getBoundingClientRect()
  const center = bounds.top + pane.clientHeight / 2
  const candidates = [...pane.querySelectorAll<HTMLElement>('.pdf-page')]
  const page =
    candidates.find((element) => {
      const box = element.getBoundingClientRect()
      return box.top <= center && box.bottom >= center
    }) ??
    candidates.reduce<HTMLElement | null>((best, element) => {
      const distance = (node: HTMLElement) =>
        Math.abs(
          node.getBoundingClientRect().top + node.getBoundingClientRect().height / 2 - center,
        )
      return !best || distance(element) < distance(best) ? element : best
    }, null)
  if (!page) return null
  const box = page.getBoundingClientRect()
  return {
    pane,
    page,
    x: (bounds.left + pane.clientWidth / 2 - box.left) / Math.max(1, box.width),
    y: (bounds.top + pane.clientHeight / 2 - box.top) / Math.max(1, box.height),
  }
}

async function restoreReadingPoint(
  point: ReturnType<typeof captureReadingPoint>,
  operation = layoutOperation,
) {
  await nextTick()
  if (
    operation !== layoutOperation ||
    !point ||
    !point.page.isConnected ||
    viewport.value !== point.pane
  )
    return
  const bounds = point.pane.getBoundingClientRect()
  const box = point.page.getBoundingClientRect()
  point.pane.scrollTop += box.top + point.y * box.height - bounds.top - point.pane.clientHeight / 2
  point.pane.scrollLeft += box.left + point.x * box.width - bounds.left - point.pane.clientWidth / 2
}

async function changeZoom(delta: number) {
  const current = session.value
  if (!current) return
  const point = captureReadingPoint()
  const page =
    Number(point?.page.closest('article')?.id.replace('pdf-page-', '')) || currentPage.value
  const dimensions = await current.getPageDimensions(page)
  if (session.value !== current) return
  const baseline = resolvePdfScale(
    fitMode.value,
    zoom.value,
    dimensions.width,
    dimensions.height,
    availableWidth.value,
    availableHeight.value,
  )
  layoutOperation += 1
  zoom.value = Math.min(4, Math.max(0.25, baseline + delta))
  fitMode.value = 'custom'
  renderedScale.value = zoom.value
  await restoreReadingPoint(point)
  emit('status', `PDF zoom set to ${Math.round(zoom.value * 100)}%.`)
}

async function setFit(mode: Extract<PdfFitMode, 'width' | 'page'>) {
  layoutOperation += 1
  const point = captureReadingPoint()
  fitMode.value = mode
  await restoreReadingPoint(point)
  emit('status', mode === 'width' ? 'Fit width enabled.' : 'Fit page enabled.')
}

function handlePageInput(event: Event) {
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

function closeRightPanel() {
  rightPanel.value = null
  void nextTick(() => {
    readerRoot.value?.querySelector<HTMLButtonElement>('button[aria-label="Contents"]')?.focus()
  })
}

function toggleRightPanel(next: Exclude<UtilityPanel, null>) {
  rightPanel.value = rightPanel.value === next ? null : next
  if (rightPanel.value === 'contents') void loadOutline()
}

async function openPopover(next: Exclude<UtilityPopover, null>) {
  popover.value = popover.value === next ? null : next
  if (popover.value === 'search') {
    await nextTick()
    searchInput.value?.focus()
  }
}

function closePopover(restoreFocus = false) {
  const closing = popover.value
  popover.value = null
  if (restoreFocus && closing) {
    void nextTick(() => {
      document.querySelector<HTMLButtonElement>(`[data-reader-action="${closing}"]`)?.focus()
    })
  }
}

function handlePopoverPointer(event: PointerEvent) {
  if (popover.value && !popoverRoot.value?.contains(event.target as Node)) {
    closePopover()
  }
}

function handlePopoverKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && popover.value) {
    event.preventDefault()
    closePopover(true)
  }
}

async function performSearch() {
  const current = session.value
  const query = searchQuery.value.trim()
  if (!current || !query || searchBusy.value) return

  searchController?.abort()
  const controller = new AbortController()
  searchController = controller
  searchBusy.value = true
  searchCompleted.value = false
  searchError.value = ''

  try {
    const result = await current.searchText(query, { signal: controller.signal })
    if (searchController !== controller) return

    completedSearchQuery.value = query
    selectedSearchMatch.value = null
    searchMatches.value = result.matches
    rightPanel.value = 'search'
    searchTextPageCount.value = result.textPageCount
    searchTruncated.value = result.truncated
    searchCompleted.value = true
    emit(
      'status',
      result.textPageCount === 0
        ? 'No searchable PDF text found.'
        : `${result.matches.length} PDF search matches found.`,
    )
    closePopover(true)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (searchController !== controller) return

    searchMatches.value = []
    searchTextPageCount.value = 0
    searchTruncated.value = false
    searchError.value = 'PDF search could not be completed. Please try again.'
    emit('status', searchError.value)
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
  if (event.target instanceof Element && event.target.closest('#document-sidebar')) return

  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'f') {
    event.preventDefault()
    void openPopover('search')
    return
  }

  if (isTypingTarget(event.target)) {
    if (event.key === 'Escape') {
      closePopover(true)
    }
    return
  }

  switch (event.key) {
    case '/':
      event.preventDefault()
      void openPopover('search')
      break
    case 'c':
    case 'C':
      event.preventDefault()
      toggleRightPanel('contents')
      break
    case 'f':
    case 'F':
      event.preventDefault()
      void toggleFullscreen()
      break
    case '?':
      event.preventDefault()
      void openPopover('help')
      break
    case 'ArrowRight':
    case 'PageDown':
      event.preventDefault()
      stepPage(1)
      break
    case 'ArrowLeft':
    case 'PageUp':
      event.preventDefault()
      stepPage(-1)
      break
    case 'Escape':
      closePopover(true)
      break
  }
}

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && viewport.value) {
    resizeObserver = new ResizeObserver(scheduleViewportMeasure)
    resizeObserver.observe(viewport.value)
  }
  void openDocument()
  globalThis.addEventListener('resize', scheduleViewportMeasure)
  globalThis.addEventListener('keydown', handleShortcut)
  globalThis.addEventListener('pointerdown', handlePopoverPointer)
  globalThis.addEventListener('keydown', handlePopoverKeydown)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

watch(
  () => props.document.id,
  () => void openDocument(),
)

onBeforeUnmount(() => {
  openSequence += 1
  documentController?.abort()
  searchController?.abort()
  cancelAnimationFrame(resizeFrame)
  cancelAnimationFrame(scrollFrame)
  resizeObserver?.disconnect()
  globalThis.removeEventListener('resize', scheduleViewportMeasure)
  globalThis.removeEventListener('keydown', handleShortcut)
  globalThis.removeEventListener('pointerdown', handlePopoverPointer)
  globalThis.removeEventListener('keydown', handlePopoverKeydown)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (document.fullscreenElement === readerRoot.value) void document.exitFullscreen()
  void closeCurrentSession()
})
</script>

<template>
  <div ref="readerRoot" class="pdf-reader min-w-0 bg-canvas">
    <p
      v-if="persistenceNotice"
      role="status"
      class="border-b border-line bg-panel px-4 py-2 text-xs text-muted"
    >
      {{ persistenceNotice }}
    </p>
    <header
      class="pdf-header relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3 sm:px-6"
    >
      <div class="min-w-0 flex-1 basis-40">
        <h2
          id="reader-title"
          class="truncate text-base font-semibold sm:text-lg"
          :title="document.name"
          :aria-label="document.name"
        >
          {{ document.name }}
        </h2>
        <p
          v-if="session"
          :style="{ visibility: phase === 'ready' ? 'visible' : 'hidden' }"
          class="mt-1 text-xs text-muted"
        >
          Page {{ currentPage }} of {{ totalPages }} · {{ progressPercent }}% · {{ zoomPercent }}%
        </p>
      </div>

      <div
        v-if="session"
        :inert="phase !== 'ready'"
        :style="{
          visibility: phase === 'ready' ? 'visible' : 'hidden',
          opacity: phase === 'ready' ? 1 : 0,
        }"
        class="flex min-w-0 flex-wrap items-center justify-end gap-1"
        aria-label="PDF reader controls"
      >
        <IconButton
          label="Previous page"
          icon="previous"
          :disabled="currentPage <= 1"
          @click="stepPage(-1)"
        />
        <input
          :value="pageEditing ? pageDraft : currentPage"
          type="number"
          min="1"
          :max="totalPages"
          class="pdf-page-input h-10 w-14 rounded-lg border border-line bg-canvas px-2 text-center text-sm"
          aria-label="Current page"
          @focus="
            pageEditing = true
            pageDraft = String(currentPage)
          "
          @input="pageDraft = ($event.target as HTMLInputElement).value"
          @blur="pageEditing = false"
          @change="handlePageInput"
        />
        <IconButton
          label="Next page"
          icon="next"
          :disabled="currentPage >= totalPages"
          @click="stepPage(1)"
        />
        <IconButton label="Zoom out" icon="zoom-out" @click="changeZoom(-0.25)" />
        <IconButton label="Zoom in" icon="zoom-in" @click="changeZoom(0.25)" />
        <IconButton
          label="Fit width"
          icon="fit-width"
          :active="fitMode === 'width'"
          :aria-pressed="fitMode === 'width'"
          @click="setFit('width')"
        />
        <IconButton
          label="Fit page"
          icon="fit-page"
          :active="fitMode === 'page'"
          :aria-pressed="fitMode === 'page'"
          @click="setFit('page')"
        />
        <IconButton
          data-reader-action="search"
          label="Search PDF"
          icon="search"
          :active="popover === 'search'"
          :aria-pressed="popover === 'search'"
          @click="openPopover('search')"
        />
        <IconButton
          :label="fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
          :icon="fullscreen ? 'fullscreen-exit' : 'fullscreen'"
          :aria-pressed="fullscreen"
          @click="toggleFullscreen"
        />
        <IconButton
          data-reader-action="help"
          label="Keyboard help"
          icon="help"
          :active="popover === 'help'"
          :aria-pressed="popover === 'help'"
          @click="openPopover('help')"
        />
        <IconButton
          label="Contents"
          icon="contents"
          :active="rightPanel === 'contents'"
          :aria-pressed="rightPanel === 'contents'"
          @click="toggleRightPanel('contents')"
        />
      </div>

      <Transition
        name="utility-popover"
        @before-enter="restoreTransitionSurface"
        @before-leave="hideTransitionSurface"
      >
        <div
          v-if="phase === 'ready' && popover"
          ref="popoverRoot"
          class="absolute top-full right-3 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-4 shadow-2xl ring-1 ring-line/30"
          :aria-label="popover === 'search' ? 'PDF search' : 'Keyboard help'"
        >
          <section v-if="popover === 'search'" aria-labelledby="pdf-search-title">
            <div class="flex items-center justify-between gap-3">
              <h3 id="pdf-search-title" class="font-semibold">Search PDF</h3>
              <IconButton label="Close search" icon="close" @click="closePopover(true)" />
            </div>
            <form class="mt-3 flex gap-2" role="search" @submit.prevent="performSearch">
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
                class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand bg-brand px-3 py-2 text-sm font-semibold text-panel transition hover:opacity-90 disabled:opacity-50"
                :aria-busy="searchBusy"
                :disabled="searchBusy || !searchQuery.trim()"
              >
                <svg
                  v-if="searchBusy"
                  class="search-spinner h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    stroke-width="3"
                    opacity="0.3"
                  />
                  <path
                    d="M12 3a9 9 0 0 1 9 9"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                </svg>
                {{ searchBusy ? 'Searching…' : 'Search' }}
              </button>
            </form>
            <p class="mt-2 text-xs leading-relaxed text-muted" role="status" aria-live="polite">
              {{ searchSummary }}
            </p>
            <p v-if="searchCompleted" class="mt-1 text-xs text-muted">
              Results are shown in the Search results panel.
            </p>
          </section>

          <section v-else aria-labelledby="pdf-help-title">
            <div class="flex items-center justify-between gap-3">
              <h3 id="pdf-help-title" class="font-semibold">Keyboard help</h3>
              <IconButton label="Close keyboard help" icon="close" @click="closePopover(true)" />
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
      </Transition>
    </header>

    <div class="pdf-body relative flex min-h-0 flex-1">
      <section
        ref="viewport"
        class="pdf-scroll min-w-0 flex-1 overflow-auto bg-canvas p-4 sm:p-6"
        aria-label="PDF pages"
        tabindex="0"
        aria-describedby="reader-title"
        :aria-busy="phase === 'loading' || phase === 'restoring'"
        @scroll.passive="handleViewerScroll"
      >
        <div
          v-if="phase === 'loading' || phase === 'restoring'"
          class="absolute inset-0 z-10 bg-canvas"
        >
          <LoadingState label="Opening document" :detail="document.name" />
        </div>

        <div
          v-if="phase === 'error'"
          class="mx-auto max-w-2xl rounded-lg border border-line bg-panel p-5"
          role="alert"
        >
          <p class="font-medium">PaperTrail could not open this PDF</p>
          <p class="mt-2 text-sm leading-relaxed text-muted">{{ errorMessage }}</p>
        </div>

        <div
          v-else-if="session"
          class="flex min-w-0 flex-col items-center gap-6"
          :inert="phase !== 'ready'"
          :aria-hidden="phase !== 'ready'"
          :style="{
            visibility: phase === 'ready' ? 'visible' : 'hidden',
            opacity: phase === 'ready' ? 1 : 0,
          }"
        >
          <PdfPageView
            v-for="pageNumber in pages"
            :key="`${openSequence}:${pageNumber}`"
            :session="session"
            :page-number="pageNumber"
            :fit-mode="fitMode"
            :zoom="zoom"
            :available-width="availableWidth"
            :available-height="availableHeight"
            :scroll-root="viewport"
            :search-query="completedSearchQuery"
            :selected-occurrence="
              selectedSearchMatch?.pageNumber === pageNumber ? selectedSearchMatch.occurrence : null
            "
            :selection-request="
              selectedSearchMatch?.pageNumber === pageNumber ? selectedSearchMatch.request : 0
            "
            @visibility="handleVisibility"
            @rendered="handleRendered"
            @error="handleRenderError"
          />
        </div>
      </section>

      <Transition
        name="utility-panel"
        @before-enter="restoreTransitionSurface"
        @before-leave="hideTransitionSurface"
      >
        <aside
          v-if="phase === 'ready' && rightPanel"
          class="pdf-side-panel absolute inset-y-0 right-0 z-10 flex w-[min(88vw,21rem)] flex-col border-l border-line bg-panel shadow-xl sm:static sm:w-[min(22rem,42vw)] sm:shadow-none"
          :aria-label="
            rightPanel === 'contents' ? 'PDF contents panel' : 'PDF search results panel'
          "
          @keydown.esc.stop.prevent="closeRightPanel"
        >
          <div
            class="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3"
          >
            <div class="flex min-w-0 items-center gap-1" aria-label="PDF utility panel mode">
              <button
                type="button"
                class="utility-tab rounded-md px-2 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand"
                :aria-pressed="rightPanel === 'contents'"
                @click="((rightPanel = 'contents'), loadOutline())"
              >
                Contents
              </button>
              <button
                type="button"
                class="utility-tab rounded-md px-2 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand"
                :aria-pressed="rightPanel === 'search'"
                @click="rightPanel = 'search'"
              >
                Search results
              </button>
            </div>
            <IconButton label="Close utility panel" icon="close" @click="closeRightPanel" />
          </div>

          <section
            v-if="rightPanel === 'contents'"
            class="min-h-0 flex-1 overflow-auto overscroll-contain p-3"
            aria-labelledby="pdf-contents-title"
          >
            <h3 id="pdf-contents-title" class="sr-only">PDF contents</h3>
            <p v-if="outlineBusy" class="p-2 text-sm text-muted" role="status">
              Loading PDF outline…
            </p>
            <p v-else-if="outlineLoaded && flatOutline.length === 0" class="p-2 text-sm text-muted">
              This PDF does not provide an outline.
            </p>
            <ul v-else-if="flatOutline.length > 0" class="space-y-1">
              <li v-for="(item, index) in flatOutline" :key="`${item.title}-${index}`">
                <button
                  v-if="item.pageNumber"
                  type="button"
                  class="min-h-9 w-full rounded-md px-2 py-1 text-left text-sm hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"
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

          <section
            v-else
            class="min-h-0 flex-1 overflow-auto overscroll-contain p-3"
            aria-labelledby="pdf-search-results-title"
          >
            <h3 id="pdf-search-results-title" class="mb-2 text-sm font-semibold">Search results</h3>
            <p
              v-if="searchCompleted"
              class="mb-2 text-xs leading-relaxed text-muted"
              role="status"
              aria-live="polite"
            >
              {{ searchSummary }}
            </p>
            <p v-else class="text-sm text-muted">Open search to find text in this PDF.</p>
            <ul v-if="searchMatches.length > 0" class="space-y-2">
              <li v-for="match in searchMatches" :key="`${match.pageNumber}-${match.occurrence}`">
                <button
                  type="button"
                  class="search-result w-full min-w-0 rounded-lg border border-line p-2 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand"
                  :aria-pressed="
                    selectedSearchMatch?.pageNumber === match.pageNumber &&
                    selectedSearchMatch?.occurrence === match.occurrence
                  "
                  @click="selectSearchMatch(match)"
                >
                  <span class="block text-xs font-semibold text-brand"
                    >Page {{ match.pageNumber }} · Match {{ match.occurrence }}</span
                  >
                  <span class="search-excerpt mt-1 block text-sm leading-relaxed text-muted"
                    ><template v-if="match.context"
                      ><span v-if="match.context.leading">…</span>{{ match.context.before
                      }}<mark>{{ match.context.term }}</mark
                      >{{ match.context.after
                      }}<span v-if="match.context.trailing">…</span></template
                    ><template v-else>{{ match.excerpt }}</template></span
                  >
                </button>
              </li>
            </ul>
          </section>
        </aside>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.search-excerpt {
  white-space: normal;
  overflow-wrap: anywhere;
}
.search-excerpt mark {
  background: #fde68a;
  color: #422006;
  border-radius: 2px;
}
.search-result[aria-pressed='true'] {
  border-color: var(--pt-brand);
  background: var(--pt-canvas);
}
.pdf-reader {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.pdf-scroll {
  overflow-anchor: none;
  min-height: 0;
  overscroll-behavior: contain;
}
.pdf-side-panel {
  min-width: 0;
  overscroll-behavior: contain;
}
/* Keep the departing panel out of flex layout while it slides away. */
.utility-panel-leave-active {
  position: absolute;
  inset: 0 0 0 auto;
  pointer-events: none;
}
.utility-panel-enter-active,
.utility-panel-leave-active {
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 320ms cubic-bezier(0.22, 1, 0.36, 1);
}
.utility-panel-enter-from,
.utility-panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
.utility-tab {
  color: var(--pt-muted);
  border: 1px solid transparent;
  transition:
    background-color 180ms ease,
    color 180ms ease,
    border-color 180ms ease;
}
.utility-tab:hover {
  background: var(--pt-canvas);
}
.utility-tab[aria-pressed='true'] {
  color: var(--pt-ink);
  background: color-mix(in srgb, var(--pt-brand) 16%, var(--pt-panel));
  border-color: var(--pt-brand);
  box-shadow: inset 0 -2px 0 var(--pt-brand);
  font-weight: 700;
}
[aria-label='PDF reader controls'] :deep(.icon-button:nth-child(-n + 3) .icon-tooltip) {
  left: 0;
  right: auto;
}
.pdf-page-input {
  appearance: textfield;
  margin-inline: 0.5rem;
}
.pdf-page-input::-webkit-inner-spin-button,
.pdf-page-input::-webkit-outer-spin-button {
  appearance: none;
  margin: 0;
}
.utility-popover-enter-active,
.utility-popover-leave-active {
  transition:
    opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: top right;
}
.utility-popover-enter-from,
.utility-popover-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem) scale(0.97);
}
.search-spinner {
  animation: search-spin 800ms linear infinite;
}
@keyframes search-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .utility-popover-enter-active,
  .utility-popover-leave-active,
  .utility-panel-enter-active,
  .utility-panel-leave-active,
  .utility-tab {
    transition: none;
  }
  .search-spinner {
    animation: none;
  }
}
</style>
