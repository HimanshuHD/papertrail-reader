<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import { RouterLink } from 'vue-router'
import ThemePicker from '../components/ThemePicker.vue'
import ReaderShell from '../components/layout/ReaderShell.vue'
import LibrarySidebar from '../components/library/LibrarySidebar.vue'
import ReaderToolbar from '../components/viewer/ReaderToolbar.vue'
import PdfReaderWorkspace from '../components/viewer/PdfReaderWorkspace.vue'
import ReaderWorkspace from '../components/viewer/ReaderWorkspace.vue'
import ShellStatus from '../components/viewer/ShellStatus.vue'
import {
  describeLibrarySelection,
  librarySelectionLabel,
  refreshActionForSelection,
  type BrowserLibrarySelection,
} from '../features/library/browser-selection'
import {
  discoverDocuments,
  type DiscoveredDocument,
  type DiscoveryProblem,
  type DiscoveryProgress,
} from '../features/library/discovery'
import type { ShellDocument, ShellViewState } from '../types/shell'

type DiscoveryPhase = 'idle' | 'indexing' | 'ready' | 'cancelled' | 'error'

const documents: readonly ShellDocument[] = [
  {
    id: 'welcome',
    title: 'Welcome to PaperTrail',
    format: 'PDF',
    collection: 'Getting started',
    detail: 'A sample reading space',
  },
  {
    id: 'field-notes',
    title: 'Notes from the trail',
    format: 'PDF',
    collection: 'Getting started',
    detail: 'An illustrative document',
  },
  {
    id: 'chapter',
    title: 'The next chapter',
    format: 'EPUB',
    collection: 'Books',
    detail: 'A sample book',
  },
]

const selectedId = ref('welcome')
const selectedLibraryDocumentId = ref<string | null>(null)
const activePdfDocument = shallowRef<DiscoveredDocument | null>(null)
const sidebarOpen = ref(true)
const sidebarToggle = ref<HTMLButtonElement | null>(null)
const viewState = ref<ShellViewState>('demo')
const announcement = ref('Demonstration workspace ready.')

const librarySelection = shallowRef<BrowserLibrarySelection | null>(null)
const discoveryPhase = ref<DiscoveryPhase>('idle')
const discoveryProgress = ref<DiscoveryProgress>({
  scanned: 0,
  supported: 0,
  currentPath: '',
})
const discoveredDocuments = shallowRef<readonly DiscoveredDocument[]>([])
const discoveryProblems = shallowRef<readonly DiscoveryProblem[]>([])
let discoveryController: AbortController | null = null

const librarySelectionSummary = computed(() =>
  librarySelection.value
    ? describeLibrarySelection(librarySelection.value)
    : 'No folder or files selected yet.',
)

const libraryLabel = computed(() =>
  librarySelection.value ? librarySelectionLabel(librarySelection.value) : 'Local documents',
)

const refreshAction = computed(() =>
  librarySelection.value ? refreshActionForSelection(librarySelection.value) : null,
)

const showLibraryResults = computed(
  () => discoveryPhase.value === 'ready' || discoveryPhase.value === 'cancelled',
)

const discoverySummary = computed(() => {
  switch (discoveryPhase.value) {
    case 'idle':
      return 'Document discovery starts after you choose a source.'
    case 'indexing':
      return `Scanning… ${discoveryProgress.value.scanned} files checked, ${discoveryProgress.value.supported} supported.`
    case 'cancelled':
      return `Discovery cancelled. ${discoveredDocuments.value.length} supported documents were found before cancellation.`
    case 'error':
      return 'Document discovery stopped unexpectedly. Your selected files were not changed.'
    case 'ready': {
      const count = discoveredDocuments.value.length
      const noun = count === 1 ? 'document' : 'documents'
      if (count === 0) {
        return discoveryProblems.value.length > 0
          ? 'No readable PDF or EPUB documents were found. Some selected items could not be accessed.'
          : 'No PDF or EPUB documents were found in this selection.'
      }
      const problemSuffix =
        discoveryProblems.value.length > 0
          ? ` ${discoveryProblems.value.length} selected item(s) could not be read.`
          : ''
      return `${count} supported ${noun} found.${problemSuffix}`
    }
    default:
      return 'Document discovery state is unavailable.'
  }
})

const selectedDocument = computed(
  () => documents.find((document) => document.id === selectedId.value) ?? documents[0]!,
)

const selectedLibraryDocument = computed(
  () =>
    discoveredDocuments.value.find((document) => document.id === selectedLibraryDocumentId.value) ??
    null,
)

function selectDocument(id: string) {
  const document = documents.find((item) => item.id === id)
  if (!document) return
  selectedId.value = id
  activePdfDocument.value = null
  announcement.value = `Selected sample: ${document.title}.`
}

function selectLibraryDocument(id: string) {
  const document = discoveredDocuments.value.find((item) => item.id === id)
  if (!document) return

  selectedLibraryDocumentId.value = id
  if (document.format === 'PDF') {
    activePdfDocument.value = document
    announcement.value = `Opening local PDF: ${document.name}.`
    return
  }

  activePdfDocument.value = null
  announcement.value = `Selected local EPUB: ${document.name}. EPUB reading remains planned in #12.`
}

function restoreLibrarySelection(
  previous: DiscoveredDocument | null,
  documents: readonly DiscoveredDocument[],
): string | null {
  if (!previous) return null

  const exact = documents.find((document) => document.id === previous.id)
  if (exact) return exact.id

  const samePath = documents.filter((document) => document.relativePath === previous.relativePath)
  return samePath.length === 1 ? samePath[0]!.id : null
}

async function runDiscovery(
  selection: BrowserLibrarySelection,
  preserveSelection: boolean,
): Promise<void> {
  const previous = preserveSelection ? selectedLibraryDocument.value : null

  discoveryController?.abort()
  const controller = new AbortController()
  discoveryController = controller
  discoveryPhase.value = 'indexing'
  discoveryProgress.value = { scanned: 0, supported: 0, currentPath: '' }
  discoveredDocuments.value = []
  discoveryProblems.value = []

  try {
    const result = await discoverDocuments(selection, {
      signal: controller.signal,
      onProgress(progress) {
        if (discoveryController === controller) discoveryProgress.value = progress
      },
    })

    if (discoveryController !== controller) return

    discoveredDocuments.value = result.documents
    discoveryProblems.value = result.problems
    selectedLibraryDocumentId.value = restoreLibrarySelection(previous, result.documents)
    discoveryPhase.value = result.status === 'cancelled' ? 'cancelled' : 'ready'
    announcement.value =
      result.status === 'cancelled'
        ? `Document discovery cancelled after ${result.scanned} files.`
        : `${result.documents.length} supported documents discovered.`
  } catch {
    if (discoveryController !== controller) return
    selectedLibraryDocumentId.value = null
    discoveryPhase.value = 'error'
    announcement.value = 'Document discovery failed.'
  }
}

async function acceptLibrarySelection(selection: BrowserLibrarySelection) {
  activePdfDocument.value = null
  librarySelection.value = selection
  selectedLibraryDocumentId.value = null
  announcement.value = describeLibrarySelection(selection)
  await runDiscovery(selection, false)
}

async function refreshLibrary() {
  const selection = librarySelection.value
  if (!selection || selection.kind !== 'directory') return

  activePdfDocument.value = null
  announcement.value = `Refreshing folder ${selection.handle.name}.`
  await runDiscovery(selection, true)
}

function cancelDiscovery() {
  discoveryController?.abort()
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
  announcement.value = sidebarOpen.value ? 'Library shown.' : 'Library hidden.'
}

async function closeSidebarAndRestoreFocus() {
  if (!sidebarOpen.value) return
  sidebarOpen.value = false
  announcement.value = 'Library hidden.'
  await nextTick()
  sidebarToggle.value?.focus()
}
</script>

<template>
  <main class="reader-app w-full" aria-label="PaperTrail application">
    <header
      class="app-header flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel px-5 py-3 sm:px-8"
    >
      <div class="flex flex-wrap items-center gap-4">
        <RouterLink to="/" class="text-xl font-bold tracking-tight" aria-label="PaperTrail home"
          >PaperTrail<span class="ml-2 text-xs font-normal text-muted">Home ↗</span></RouterLink
        >
        <span class="rounded-full border border-line px-3 py-1 text-xs text-muted">{{
          activePdfDocument ? 'PDF reader' : 'Layout preview'
        }}</span>
      </div>
      <ThemePicker />
    </header>
    <div
      class="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-2 sm:px-8"
    >
      <button
        ref="sidebarToggle"
        type="button"
        aria-controls="document-sidebar"
        :aria-expanded="sidebarOpen"
        class="min-h-11 rounded-lg border border-line bg-panel px-4 py-2 text-sm font-medium"
        @click="toggleSidebar"
      >
        {{ sidebarOpen ? 'Hide library' : 'Show library' }}
      </button>
      <p class="text-xs text-muted">Local-first reading · PDF &amp; EPUB</p>
    </div>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

    <ReaderShell :sidebar-open="sidebarOpen" @close="closeSidebarAndRestoreFocus">
      <template #sidebar>
        <LibrarySidebar
          :documents="documents"
          :selected-id="selectedId"
          :library-documents="discoveredDocuments"
          :selected-library-document-id="selectedLibraryDocumentId"
          :library-label="libraryLabel"
          :show-library-results="showLibraryResults"
          :refresh-action="refreshAction"
          :selection-summary="librarySelectionSummary"
          :discovery-summary="discoverySummary"
          :discovery-busy="discoveryPhase === 'indexing'"
          :discovery-problem-count="discoveryProblems.length"
          @select="selectDocument"
          @select-library-document="selectLibraryDocument"
          @library-selection="acceptLibrarySelection"
          @refresh-library="refreshLibrary"
          @cancel-discovery="cancelDiscovery"
          @close="closeSidebarAndRestoreFocus"
        />
      </template>
      <template v-if="!activePdfDocument" #toolbar>
        <ReaderToolbar :document="selectedDocument" />
      </template>
      <PdfReaderWorkspace
        v-if="activePdfDocument"
        :document="activePdfDocument"
        @status="announcement = $event"
      />
      <template v-else>
        <ShellStatus :state="viewState" />
        <ReaderWorkspace v-if="viewState === 'demo'" :document="selectedDocument" />
      </template>
    </ReaderShell>
  </main>
</template>

<style scoped>
.reader-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.app-header {
  flex-shrink: 0;
  max-height: min(25%, 100px);
  overflow: auto;
}
</style>
