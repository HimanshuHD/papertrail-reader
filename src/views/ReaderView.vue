<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import { RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import IconButton from '../components/IconButton.vue'
import ThemePicker from '../components/ThemePicker.vue'
import ReaderShell from '../components/layout/ReaderShell.vue'
import LibrarySidebar from '../components/library/LibrarySidebar.vue'
import PdfReaderWorkspace from '../components/viewer/PdfReaderWorkspace.vue'
import ReaderWorkspace from '../components/viewer/ReaderWorkspace.vue'
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

import { waitForMinimumLoading } from '../features/library/loading-duration'
import { enrichPdfTitles } from '../features/library/pdf-titles'

type DiscoveryPhase = 'idle' | 'indexing' | 'ready' | 'cancelled' | 'error'

const selectedLibraryDocumentId = ref<string | null>(null)
const activePdfDocument = shallowRef<DiscoveredDocument | null>(null)
const sidebarOpen = ref(true)
const sidebarToggle = ref<InstanceType<typeof IconButton> | null>(null)
const announcement = ref('PaperTrail workspace ready. No documents selected yet.')

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
let metadataController: AbortController | null = null
onBeforeUnmount(() => {
  discoveryController?.abort()
  metadataController?.abort()
})

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

const selectedLibraryDocument = computed(
  () =>
    discoveredDocuments.value.find((document) => document.id === selectedLibraryDocumentId.value) ??
    null,
)

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
  announcement.value = `Selected local EPUB: ${document.name}. EPUB reading is planned for Roadmap 2.`
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
  metadataController?.abort()
  const controller = new AbortController()
  const startedAt = Date.now()
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
    if (result.status === 'completed' && result.problems.length === 0)
      await waitForMinimumLoading(startedAt, controller.signal)
    if (discoveryController !== controller) return
    const cancelled = result.status === 'cancelled' || controller.signal.aborted
    if (!cancelled) {
      const metadata = new AbortController()
      metadataController = metadata
      void enrichPdfTitles(result.documents, metadata.signal, (id, title) => {
        if (metadataController !== metadata || metadata.signal.aborted) return
        discoveredDocuments.value = discoveredDocuments.value.map((document) =>
          document.id === id ? { ...document, title } : document,
        )
      })
    }
    discoveryPhase.value = cancelled ? 'cancelled' : 'ready'
    announcement.value = cancelled
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
  discoveryPhase.value = 'cancelled'
  announcement.value = 'Document discovery cancelled.'
}

async function openSidebar() {
  sidebarOpen.value = true
  announcement.value = 'Library shown.'
  await nextTick()
  document
    .querySelector<HTMLButtonElement>('#document-sidebar button[aria-label="Hide library"]')
    ?.focus()
}

async function closeSidebarAndRestoreFocus() {
  if (!sidebarOpen.value) return
  sidebarOpen.value = false
  announcement.value = 'Library hidden.'
  await nextTick()
  const opener = sidebarToggle.value?.$el as HTMLButtonElement | undefined
  opener?.focus()
}
</script>

<template>
  <main class="reader-app w-full" aria-label="PaperTrail application">
    <header
      class="app-header flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel px-5 py-3 sm:px-8"
    >
      <div class="flex flex-wrap items-center gap-4">
        <RouterLink
          to="/"
          class="inline-flex items-center gap-2 text-xl font-bold tracking-tight"
          aria-label="PaperTrail home"
          ><BrandMark class="h-8 w-8" />PaperTrail<span class="ml-2 text-xs font-normal text-muted"
            >Home ↗</span
          ></RouterLink
        >
        <span class="rounded-full border border-line px-3 py-1 text-xs text-muted">{{
          activePdfDocument
            ? 'PDF reader'
            : selectedLibraryDocument?.format === 'EPUB'
              ? 'EPUB · planned'
              : 'Reader workspace'
        }}</span>
      </div>
      <ThemePicker />
    </header>
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

    <ReaderShell :sidebar-open="sidebarOpen" @close="closeSidebarAndRestoreFocus">
      <template v-if="!sidebarOpen" #opener>
        <IconButton
          ref="sidebarToggle"
          label="Show library"
          icon="library"
          tooltip-align="start"
          aria-controls="document-sidebar"
          aria-expanded="false"
          class="floating-library border border-line bg-panel text-brand shadow-lg"
          @click="openSidebar"
        />
      </template>
      <template #sidebar>
        <LibrarySidebar
          :library-documents="discoveredDocuments"
          :selected-library-document-id="selectedLibraryDocumentId"
          :library-label="libraryLabel"
          :show-library-results="showLibraryResults"
          :refresh-action="refreshAction"
          :selection-summary="librarySelectionSummary"
          :discovery-summary="discoverySummary"
          :discovery-busy="discoveryPhase === 'indexing'"
          :discovery-problem-count="discoveryProblems.length"
          @select-library-document="selectLibraryDocument"
          @library-selection="acceptLibrarySelection"
          @refresh-library="refreshLibrary"
          @cancel-discovery="cancelDiscovery"
          @close="closeSidebarAndRestoreFocus"
        />
      </template>
      <PdfReaderWorkspace
        v-if="activePdfDocument"
        :document="activePdfDocument"
        @status="announcement = $event"
      />
      <ReaderWorkspace
        v-else
        :selected-document="selectedLibraryDocument"
        :has-library-selection="Boolean(librarySelection)"
      />
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
