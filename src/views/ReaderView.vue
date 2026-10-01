<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import { RouterLink } from 'vue-router'
import ThemePicker from '../components/ThemePicker.vue'
import ReaderShell from '../components/layout/ReaderShell.vue'
import LibrarySidebar from '../components/library/LibrarySidebar.vue'
import ReaderToolbar from '../components/viewer/ReaderToolbar.vue'
import ReaderWorkspace from '../components/viewer/ReaderWorkspace.vue'
import ShellStatus from '../components/viewer/ShellStatus.vue'
import {
  describeLibrarySelection,
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

function selectDocument(id: string) {
  const document = documents.find((item) => item.id === id)
  if (!document) return
  selectedId.value = id
  announcement.value = `Selected sample: ${document.title}.`
}

async function acceptLibrarySelection(selection: BrowserLibrarySelection) {
  librarySelection.value = selection
  announcement.value = describeLibrarySelection(selection)

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
    discoveryPhase.value = result.status === 'cancelled' ? 'cancelled' : 'ready'
    announcement.value =
      result.status === 'cancelled'
        ? `Document discovery cancelled after ${result.scanned} files.`
        : `${result.documents.length} supported documents discovered.`
  } catch {
    if (discoveryController !== controller) return
    discoveryPhase.value = 'error'
    announcement.value = 'Document discovery failed.'
  }
}

function cancelDiscovery() {
  discoveryController?.abort()
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
  announcement.value = sidebarOpen.value ? 'Sample library shown.' : 'Sample library hidden.'
}

async function closeSidebarAndRestoreFocus() {
  if (!sidebarOpen.value) return
  sidebarOpen.value = false
  announcement.value = 'Sample library hidden.'
  await nextTick()
  sidebarToggle.value?.focus()
}
</script>

<template>
  <main class="mx-auto w-full max-w-[1600px]" aria-label="PaperTrail application">
    <header
      class="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel px-5 py-4 sm:px-8"
    >
      <div class="flex flex-wrap items-center gap-4">
        <RouterLink to="/" class="text-xl font-bold tracking-tight" aria-label="PaperTrail home"
          >PaperTrail<span class="ml-2 text-xs font-normal text-muted">Home ↗</span></RouterLink
        >
        <span class="rounded-full border border-line px-3 py-1 text-xs text-muted"
          >Layout preview</span
        >
      </div>
      <ThemePicker />
    </header>
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-8"
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

    <ReaderShell :sidebar-open="sidebarOpen">
      <template #sidebar>
        <LibrarySidebar
          :documents="documents"
          :selected-id="selectedId"
          :selection-summary="librarySelectionSummary"
          :discovery-summary="discoverySummary"
          :discovery-busy="discoveryPhase === 'indexing'"
          :discovery-problem-count="discoveryProblems.length"
          @select="selectDocument"
          @library-selection="acceptLibrarySelection"
          @cancel-discovery="cancelDiscovery"
          @close="closeSidebarAndRestoreFocus"
        />
      </template>
      <template #toolbar><ReaderToolbar :document="selectedDocument" /></template>
      <ShellStatus :state="viewState" />
      <ReaderWorkspace v-if="viewState === 'demo'" :document="selectedDocument" />
    </ReaderShell>
  </main>
</template>
