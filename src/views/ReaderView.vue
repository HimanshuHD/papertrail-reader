<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, shallowRef } from 'vue'
import { RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import IconButton from '../components/IconButton.vue'
import ThemePicker from '../components/ThemePicker.vue'
import ReaderShell from '../components/layout/ReaderShell.vue'
import LibrarySidebar from '../components/library/LibrarySidebar.vue'
import PdfReaderWorkspace from '../components/viewer/PdfReaderWorkspace.vue'
import ReaderWorkspace from '../components/viewer/ReaderWorkspace.vue'
import EpubReaderWorkspace from '../components/viewer/EpubReaderWorkspace.vue'
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

import { useWorkspaceContinuity } from '../composables/useWorkspaceContinuity'
import { cacheLibraryDocuments, type WorkspaceSnapshot } from '../services/workspace-storage'
import { revalidateWorkspace } from '../services/workspace-revalidation'

import { useRecentDocuments } from '../composables/useRecentDocuments'
import { matchRecent, type RecentDocument } from '../services/recent-documents'

type DiscoveryPhase = 'idle' | 'indexing' | 'ready' | 'cancelled' | 'error'

const workspace = useWorkspaceContinuity()
const recents = useRecentDocuments()
const recentMessage = ref('')
const recentOpening = ref(false)
let recentController: AbortController | null = null
function cancelRecent() {
  recentController?.abort()
  recentOpening.value = false
}
function rememberRecent(identity: { id: string; fingerprint: string }) {
  const item = activePdfDocument.value
  if (item)
    void recents.remember({
      ...identity,
      name: item.name,
      title: item.title,
      relativePath: item.relativePath,
      openedAt: Date.now(),
    })
}
async function openRecent(entry: RecentDocument) {
  cancelRecent()
  const controller = new AbortController()
  recentController = controller
  recentOpening.value = true
  recentMessage.value = 'Checking recent document access…'
  try {
    const item = await matchRecent(entry, discoveredDocuments.value, controller.signal)
    if (controller.signal.aborted) return
    if (item) {
      selectLibraryDocument(item.id)
      recentMessage.value = ''
    } else
      recentMessage.value =
        'This recent PDF is unavailable or changed. Use + to reselect its source, then try it again.'
  } catch {
    if (!controller.signal.aborted)
      recentMessage.value = 'Recent PDF access could not be checked. Use + to reselect its source.'
  } finally {
    if (recentController === controller) recentOpening.value = false
  }
}
const sidebarWidth = ref(308)
const reconnecting = ref(false)
let workspaceOperation = 0
const displayDocuments = computed(() =>
  discoveredDocuments.value.length || discoveryPhase.value === 'ready'
    ? discoveredDocuments.value
    : (workspace.snapshot.value?.documents ?? []),
)
const cached = computed(
  () =>
    Boolean(workspace.snapshot.value) &&
    (!librarySelection.value || (reconnecting.value && !discoveredDocuments.value.length)),
)
const workspaceMessage = computed(
  () =>
    workspace.notice.value ||
    (reconnecting.value
      ? 'Reconnecting your library…'
      : cached.value
        ? 'Saved library. Resume access or use + to select the same source again.'
        : ''),
)
const selectedLibraryDocumentId = ref<string | null>(null)
const activePdfDocument = shallowRef<DiscoveredDocument | null>(null)
const activeEpubDocument = computed(
  () =>
    discoveredDocuments.value.find(
      (item) => item.id === selectedLibraryDocumentId.value && item.format === 'EPUB',
    ) ?? null,
)
const sidebarOpen = ref(true)
watch(sidebarOpen, (value) => workspace.patch({ sidebarOpen: value }))
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
  workspaceOperation += 1
  cancelRecent()
  discoveryController?.abort()
  metadataController?.abort()
})

const librarySelectionSummary = computed(() =>
  librarySelection.value
    ? describeLibrarySelection(librarySelection.value)
    : 'No folder or files selected yet.',
)

const libraryLabel = computed(() =>
  librarySelection.value
    ? librarySelectionLabel(librarySelection.value)
    : (workspace.snapshot.value?.label ?? 'Local documents'),
)

const refreshAction = computed(() =>
  librarySelection.value ? refreshActionForSelection(librarySelection.value) : null,
)

const showLibraryResults = computed(
  () =>
    Boolean(workspace.snapshot.value) ||
    discoveryPhase.value === 'ready' ||
    discoveryPhase.value === 'cancelled',
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
    displayDocuments.value.find((document) => document.id === selectedLibraryDocumentId.value) ??
    null,
)

function selectLibraryDocument(id: string, restoring = false) {
  const document = discoveredDocuments.value.find((item) => item.id === id)
  if (!document) return

  if (!restoring) {
    workspaceOperation += 1
    cancelRecent()
    reconnecting.value = false
  }
  const sameActive =
    activePdfDocument.value?.id === document.id && activePdfDocument.value?.file === document.file
  selectedLibraryDocumentId.value = id
  workspace.patch({
    selectedPath: document.relativePath,
    activePath: document.format === 'PDF' ? document.relativePath : null,
    activeFingerprint:
      restoring || sameActive ? (workspace.snapshot.value?.activeFingerprint ?? null) : null,
  })
  if (document.format === 'PDF') {
    activePdfDocument.value = document
    announcement.value = `Opening local PDF: ${document.name}.`
    return
  }

  activePdfDocument.value = null
  announcement.value = `Opening local EPUB: ${document.name}.`
}

function restoreLibrarySelection(
  previous: { id: string; relativePath: string } | null,
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
  quiet = false,
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
    workspace.patch({ documents: cacheLibraryDocuments(result.documents) })
    discoveryProblems.value = result.problems
    selectedLibraryDocumentId.value = restoreLibrarySelection(previous, result.documents)
    if (!quiet && result.status === 'completed' && result.problems.length === 0)
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
        workspace.patch({ documents: cacheLibraryDocuments(discoveredDocuments.value) })
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

async function reconnect(
  selection: BrowserLibrarySelection,
  saved: WorkspaceSnapshot,
  owner: number,
) {
  reconnecting.value = true
  librarySelection.value = selection
  activePdfDocument.value = null
  try {
    await runDiscovery(selection, false, true)
    if (owner !== workspaceOperation || discoveryPhase.value !== 'ready') return
    const result = await revalidateWorkspace(
      saved,
      discoveredDocuments.value,
      discoveryController?.signal,
    )
    if (owner !== workspaceOperation) return
    selectedLibraryDocumentId.value = result.selectedId
    if (result.activeDocument) {
      selectLibraryDocument(result.activeDocument.id, true)
    } else if (saved.activePath) {
      workspace.notice.value =
        'The previously opened PDF changed or is unavailable. Select a document to continue.'
      workspace.patch({ activePath: null, activeFingerprint: null })
    }
  } catch {
    if (owner === workspaceOperation)
      workspace.notice.value = 'Library access could not be restored. Choose your source again.'
  } finally {
    if (owner === workspaceOperation) reconnecting.value = false
  }
}

async function acceptLibrarySelection(selection: BrowserLibrarySelection) {
  const saved = workspace.snapshot.value
  const owner = ++workspaceOperation
  cancelRecent()
  const label = librarySelectionLabel(selection)
  if (saved && cached.value && saved.label === label && saved.source === selection.source) {
    workspace.patch({ handle: selection.kind === 'directory' ? selection.handle : null })
    await reconnect(selection, saved, owner)
    return
  }
  reconnecting.value = false
  activePdfDocument.value = null
  librarySelection.value = selection
  selectedLibraryDocumentId.value = null
  workspace.remember({
    version: 1,
    source: selection.source,
    label,
    handle: selection.kind === 'directory' ? selection.handle : null,
    documents: [],
    selectedPath: null,
    activePath: null,
    activeFingerprint: null,
    collapsedPaths: [],
    libraryScroll: 0,
    sidebarOpen: sidebarOpen.value,
    sidebarWidth: sidebarWidth.value,
  })
  announcement.value = describeLibrarySelection(selection)
  await runDiscovery(selection, false)
}

async function resumeWorkspace() {
  const saved = workspace.snapshot.value
  if (!saved || reconnecting.value) return
  const owner = ++workspaceOperation
  cancelRecent()
  const access = await workspace.resume()
  if (owner !== workspaceOperation) return
  if (access?.status === 'granted') await reconnect(access.selection, saved, owner)
  else
    workspace.notice.value = 'Access was not granted. Resume again or use + to reselect the source.'
}

async function forgetWorkspace() {
  workspaceOperation += 1
  cancelRecent()
  discoveryController?.abort()
  metadataController?.abort()
  discoveryController = null
  metadataController = null
  reconnecting.value = false
  activePdfDocument.value = null
  librarySelection.value = null
  discoveredDocuments.value = []
  selectedLibraryDocumentId.value = null
  discoveryPhase.value = 'idle'
  await workspace.forget()
}

function saveSidebarWidth(width: number) {
  sidebarWidth.value = width
  workspace.patch({ sidebarWidth: width })
}

function toggleFolder(path: string, expanded: boolean) {
  const paths = new Set(workspace.snapshot.value?.collapsedPaths ?? [])
  if (expanded) paths.delete(path)
  else paths.add(path)
  workspace.patch({ collapsedPaths: [...paths] })
}

onMounted(async () => {
  const owner = workspaceOperation
  const access = await workspace.restore((saved) => {
    if (owner !== workspaceOperation) return
    sidebarOpen.value = saved.sidebarOpen
    sidebarWidth.value = saved.sidebarWidth
    selectedLibraryDocumentId.value =
      saved.documents.find((item) => item.relativePath === saved.selectedPath)?.id ?? null
  })
  const saved = workspace.snapshot.value
  if (!saved || owner !== workspaceOperation) return
  if (access?.status === 'granted') await reconnect(access.selection, saved, owner)
})

async function refreshLibrary() {
  workspaceOperation += 1
  cancelRecent()
  reconnecting.value = false
  workspace.patch({ activePath: null, activeFingerprint: null })
  const selection = librarySelection.value
  if (!selection || selection.kind !== 'directory') return

  activePdfDocument.value = null
  announcement.value = `Refreshing folder ${selection.handle.name}.`
  await runDiscovery(selection, true)
}

function cancelDiscovery() {
  workspaceOperation += 1
  cancelRecent()
  reconnecting.value = false
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
              ? 'EPUB reader'
              : 'Reader workspace'
        }}</span>
      </div>
      <ThemePicker />
    </header>
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

    <ReaderShell
      :sidebar-open="sidebarOpen"
      :initial-width="sidebarWidth"
      @width-change="saveSidebarWidth"
      @close="closeSidebarAndRestoreFocus"
    >
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
          :library-documents="displayDocuments"
          :recent-documents="recents.entries.value"
          :recent-message="recentMessage || recents.notice.value"
          :recent-busy="recentOpening || recents.busy.value"
          :collapsed-paths="workspace.snapshot.value?.collapsedPaths"
          :scroll-position="workspace.snapshot.value?.libraryScroll"
          :cached="cached"
          :has-workspace="Boolean(workspace.snapshot.value) || Boolean(workspace.notice.value)"
          :workspace-message="workspaceMessage"
          :can-resume="Boolean(workspace.snapshot.value?.handle) && cached && !reconnecting"
          :selected-library-document-id="selectedLibraryDocumentId"
          :library-label="libraryLabel"
          :show-library-results="showLibraryResults"
          :refresh-action="refreshAction"
          :selection-summary="librarySelectionSummary"
          :discovery-summary="discoverySummary"
          :discovery-busy="discoveryPhase === 'indexing' && !cached"
          :discovery-problem-count="discoveryProblems.length"
          @open-recent="openRecent"
          @remove-recent="recents.remove($event)"
          @clear-recents="recents.remove()"
          @retry-recents="recents.reload()"
          @toggle-folder="toggleFolder"
          @library-scroll="workspace.patch({ libraryScroll: $event })"
          @resume-workspace="resumeWorkspace"
          @forget-workspace="forgetWorkspace"
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
        :initial-panel="workspace.snapshot.value?.utilityPanel"
        :initial-search-query="workspace.snapshot.value?.searchQuery"
        @utility-change="
          (panel, query) => workspace.patch({ utilityPanel: panel, searchQuery: query })
        "
        @status="announcement = $event"
        @identity="workspace.patch({ activeFingerprint: $event })"
        @recent-ready="rememberRecent"
      />
      <EpubReaderWorkspace
        v-else-if="activeEpubDocument"
        :document="activeEpubDocument"
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
